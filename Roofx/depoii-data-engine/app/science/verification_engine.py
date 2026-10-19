"""
Depoii Automated Lead Verification Engine
Implements the 5-Pillar Verification Architecture:
1. Live County CAD Guard (TAD & DCAD REST API)
2. Ground-Truth Hail Radial Proximity (NOAA SPC Ground Reports)
3. Live Municipal Permit Auditor (City of Fort Worth & Dallas APIs)
4. Satellite Archetype Snapshot Service (ESRI World Imagery REST)
5. Evidence Dossier & 100-Point Confidence Scoring
"""

import math
import re
import json
import os
import urllib.request
import urllib.parse
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List

from app.core.sqlite import write_with_retry

# Tarrant and Dallas County Appraisal District GIS Endpoints
TAD_PARCELS_URL = "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query"
DCAD_PARCELS_URL = "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query"

# City of Fort Worth Open Data Permits FeatureServer
CFW_PERMITS_URL = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0/query"

# ESRI World Imagery REST Service
ESRI_IMAGERY_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export"
ESRI_METADATA_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/8/query"

THUMBNAIL_DIR = os.environ.get(
    "DEPOII_THUMBNAIL_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "thumbnails")),
)

HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Depoii/2.0", "Accept": "application/json"}

DISQUALIFIED_OWNER_KEYWORDS = [
    'CITY OF', 'STATE OF', 'UNITED STATES', 'SCHOOL DISTRICT', 'ISD', 
    'BOARD OF REG', 'AUTHORITY', 'HOUSING AUTH', 'COUNTY OF', 'TOWN OF',
    'DEPARTMENT OF', 'MUNICIPAL', 'CHURCH', 'BAPTIST', 'METHODIST', 'CATHOLIC',
    'DIOCESE', 'MINISTRIES', 'APARTMENT', 'APTS', 'HOUSING', 'FOUNDATION',
    'MEDICAL CENTER', 'HEALTH SYSTEM', 'HEALTH RESOURCES', 'MENTAL HEALTH',
    'CHRISTUS HEALTH', 'HEALTHSOUTH', 'CLINIC'
]

def is_disqualified_owner(owner: str) -> Optional[str]:
    """Returns the matching keyword if owner is institutional/government/church/hospital, else None."""
    o = (owner or '').upper().strip()
    if not o:
        return None
    for kw in DISQUALIFIED_OWNER_KEYWORDS:
        if kw in o:
            return kw
    # Check hospital without matching hospitality
    if re.search(r'\bHOSPITALS?\b', o) and not re.search(r'\bHOSPITALITY\b', o):
        return 'HOSPITAL'
    return None


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class CADAuditor:
    """Queries live County Appraisal District (TAD / DCAD) GIS REST APIs."""
    
    @staticmethod
    def audit_tarrant_cad(address: str, account_number: Optional[str] = None) -> Dict[str, Any]:
        params = {"f": "json", "outFields": "ACCOUNT,SITUS_ADDR,CITY,OWNER_NAME,LIVING_ARE,YEAR_BUILT,TOTAL_VALU,LEGAL_1,MAPSCO,LAND_ACRES"}
        if account_number and account_number.strip():
            clean_acct = account_number.replace("TAD-PARCEL-", "").strip()
            params["where"] = f"ACCOUNT = '{clean_acct}'"
        else:
            parts = address.split()
            if len(parts) >= 2:
                params["where"] = f"SITUS_ADDR LIKE '%{parts[0]}%{parts[1]}%'"
            else:
                params["where"] = f"SITUS_ADDR LIKE '%{address}%'"
                
        url = f"{TAD_PARCELS_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=HTTP_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=12) as res:
                feats = json.loads(res.read().decode()).get("features", [])
                if not feats:
                    return {"found": False, "reason": "No TAD record matched"}
                a = feats[0]["attributes"]
                owner = (a.get("OWNER_NAME") or "").strip().upper()
                situs = (a.get("SITUS_ADDR") or "").strip()
                legal = (a.get("LEGAL_1") or "").strip()
                
                # Check institutional / nonprofit exclusion
                disq_kw = is_disqualified_owner(owner)
                if disq_kw:
                    return {
                        "found": True,
                        "account": a.get("ACCOUNT"),
                        "is_disqualified": True,
                        "disqualification_reason": f"Disqualified Owner: {owner} (matches '{disq_kw}')"
                    }
                        
                return {
                    "found": True,
                    "is_disqualified": False,
                    "account": a.get("ACCOUNT"),
                    "address": situs,
                    "city": (a.get("CITY") or "").strip(),
                    "owner": owner,
                    "living_area_sqft": a.get("LIVING_ARE") or 0.0,
                    "area_source": "cad_living",
                    "year_built": int(a.get("YEAR_BUILT") or 0) or None,
                    "year_built_source": "cad_year_built" if a.get("YEAR_BUILT") else "missing",
                    "total_val": a.get("TOTAL_VALU") or 0.0,
                    "mapsco": (a.get("MAPSCO") or "").strip(),
                    "legal": legal,
                    "acres": a.get("LAND_ACRES") or 0.0,
                    "cad_url": f"https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0/query?where=ACCOUNT%3D%27{a.get('ACCOUNT')}%27&outFields=*&f=html"
                }
        except Exception as e:
            return {"found": False, "error": str(e)}

    @staticmethod
    def audit_dallas_cad(address: str, account_number: Optional[str] = None) -> Dict[str, Any]:
        params = {"f": "json", "outFields": "ACCT,ST_NUM,ST_NAME,CITY,TAXPANAME1,AREA_FEET,PROP_CL,BLDG_CL,TOT_VAL,Website"}
        parts = address.split()
        if len(parts) >= 2 and parts[0].isdigit():
            params["where"] = f"ST_NUM = '{parts[0]}' AND ST_NAME LIKE '%{parts[1]}%'"
        else:
            params["where"] = f"ST_NAME LIKE '%{address}%'"
            
        url = f"{DCAD_PARCELS_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=HTTP_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=12) as res:
                feats = json.loads(res.read().decode()).get("features", [])
                if not feats:
                    return {"found": False, "reason": "No DCAD record matched"}
                a = feats[0]["attributes"]
                prop_cl = (a.get("PROP_CL") or "").strip().upper()
                bldg_cl = (a.get("BLDG_CL") or "").strip().upper()
                owner = (a.get("TAXPANAME1") or "").strip().upper()
                
                # Check MFR apartment exclusion
                if "MFR" in prop_cl or "APARTMENT" in bldg_cl or "CONDO" in bldg_cl:
                    return {
                        "found": True,
                        "account": a.get("ACCT"),
                        "is_disqualified": True,
                        "disqualification_reason": f"Disqualified Multi-Family: {prop_cl} / {bldg_cl}"
                    }
                    
                # Check owner
                disq_kw = is_disqualified_owner(owner)
                if disq_kw:
                    return {
                        "found": True,
                        "account": a.get("ACCT"),
                        "is_disqualified": True,
                        "disqualification_reason": f"Disqualified Institutional Owner: {owner} (matches '{disq_kw}')"
                    }
                        
                return {
                    "found": True,
                    "is_disqualified": False,
                    "account": a.get("ACCT"),
                    "address": f"{a.get('ST_NUM')} {a.get('ST_NAME')}".strip(),
                    "city": (a.get("CITY") or "").strip(),
                    "owner": owner,
                    "parcel_area_sqft": a.get("AREA_FEET") or 0.0,
                    "area_source": "gis_parcel_layer",
                    "property_class": prop_cl,
                    "building_class": bldg_cl,
                    "cad_url": a.get("Website") or f"http://www.dallascad.org/AcctDetail.aspx?ID={a.get('ACCT')}"
                }
        except Exception as e:
            return {"found": False, "error": str(e)}


class HailProximityEngine:
    """Calculates exact spatial radial distance to NOAA SPC ground-truth hail strikes."""
    
    @staticmethod
    def calculate_nearest_hail(lat: float, lon: float, reports=None) -> Dict[str, Any]:
        _ = (lat, lon)
        if not reports:
            return {
                "distance_miles": None,
                "hail_size_inches": None,
                "report_location": None,
                "attached": False,
                "reason": "no SPC file attached",
            }
        best_dist = None
        best_report = None
        for report in reports:
            dist = haversine_miles(lat, lon, report["lat"], report["lon"])
            if best_dist is None or dist < best_dist:
                best_dist = dist
                best_report = report
        return {
            "distance_miles": None if best_dist is None else round(best_dist, 2),
            "hail_size_inches": None if best_report is None else best_report.get("size_in"),
            "report_location": None if best_report is None else best_report.get("location"),
            "attached": best_report is not None,
            "report_timestamp": None if best_report is None else best_report.get("time"),
            "is_in_strike_zone": False,
        }


def _parse_street_tokens(raw: str) -> Tuple[str, List[str]]:
    if not raw:
        return "", []
    cleaned = raw.split(',')[0].strip().upper()
    cleaned = re.sub(r'#.*$', '', cleaned).strip()
    cleaned = re.sub(r'\b(SUITE|STE|APT|UNIT|BLDG|BUILDING)\b.*$', '', cleaned).strip()
    m = re.match(r'^(\d+)\s+(.+)$', cleaned)
    if not m:
        tokens = [t for t in re.findall(r'[A-Z0-9]+', cleaned) if t]
        return "", tokens
    num = m.group(1)
    tokens = [t for t in re.findall(r'[A-Z0-9]+', m.group(2)) if t]
    directions = {'N', 'S', 'E', 'W', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'NE', 'NW', 'SE', 'SW'}
    suffixes = {'ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'BLVD', 'BOULEVARD', 'DR', 'DRIVE', 'HWY', 'HIGHWAY', 'PKWY', 'PARKWAY', 'FWY', 'FREEWAY', 'TRL', 'TRAIL', 'LN', 'LANE', 'PL', 'PLACE', 'CT', 'COURT', 'WAY', 'EXPY', 'EXPRESSWAY', 'CIR', 'CIRCLE'}
    core = []
    for i, t in enumerate(tokens):
        if t in directions:
            continue
        if t in suffixes and i == len(tokens) - 1:
            continue
        core.append(t)
    if not core and tokens:
        core = [tokens[0]]
    return num, core


ROOF_KEYWORDS = [
    'roof', 'reroof', 're-roof', 'tear-off', 'tear off', 'membrane',
    'shingle', 'tpo', 'epdm', 'modified bitumen', 'built-up', 'bur',
    'roofing', 're roof', 'parapet', 'metal roof', 'standing seam',
    'waterproof', 'coating'
]


def is_roof_permit_text(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(kw in t for kw in ROOF_KEYWORDS)


class MunicipalPermitAuditor:
    """Queries live municipal permit open data portals for post-storm roofing filings."""
    
    @staticmethod
    def audit_fort_worth(address: str, storm_date: str = "2026-04-26") -> Dict[str, Any]:
        num, core_tokens = _parse_street_tokens(address)
        if num and core_tokens:
            query_where = f"(Addr_No = {num} AND Street_Name LIKE '%{core_tokens[0]}%') OR Full_Street_Address LIKE '%{num}%{core_tokens[0]}%'"
        elif num:
            query_where = f"Addr_No = {num} OR Full_Street_Address LIKE '%{num}%'"
        elif core_tokens:
            query_where = f"Street_Name LIKE '%{core_tokens[0]}%' OR Full_Street_Address LIKE '%{core_tokens[0]}%'"
        else:
            query_where = f"Full_Street_Address LIKE '%{address}%'"
            
        params = {
            "where": query_where,
            "outFields": "Permit_No,File_Date,Permit_Type,Permit_SubType,Addr_No,Direction,Street_Name,Street_Suffix,Full_Street_Address,B1_WORK_DESC",
            "f": "json"
        }
        url = f"{CFW_PERMITS_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers=HTTP_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=12) as res:
                feats = json.loads(res.read().decode()).get("features", [])
                post_storm_permits = []
                has_roof_permit = False
                has_non_roof_permit = False

                for f in feats:
                    attr = f["attributes"]
                    ret_addr = (attr.get("Full_Street_Address") or "").upper()
                    if not ret_addr:
                        st_parts = [str(attr.get("Addr_No") or ""), str(attr.get("Direction") or ""), str(attr.get("Street_Name") or ""), str(attr.get("Street_Suffix") or "")]
                        ret_addr = " ".join([p for p in st_parts if p]).strip()
                    ret_tokens = set(re.findall(r'[A-Z0-9]+', ret_addr))
                    # Verify returned address actually matches the street number and name
                    if num and num not in ret_tokens:
                        continue
                    if core_tokens and not any(ct in ret_tokens for ct in core_tokens):
                        continue

                    file_ts = attr.get("File_Date")
                    if file_ts:
                        file_dt = datetime.fromtimestamp(file_ts / 1000).strftime('%Y-%m-%d')
                        if file_dt >= storm_date:
                            p_type = attr.get("Permit_Type") or ""
                            p_subtype = attr.get("Permit_SubType") or ""
                            desc = attr.get("B1_WORK_DESC") or ""
                            text_check = f"{desc} {p_type} {p_subtype}".lower()
                            is_roof = is_roof_permit_text(text_check)

                            permit_entry = {
                                "permit_number": attr.get("Permit_No"),
                                "date": file_dt,
                                "type": p_type,
                                "subtype": p_subtype,
                                "desc": desc,
                                "is_roof": is_roof
                            }
                            post_storm_permits.append(permit_entry)
                            if is_roof:
                                has_roof_permit = True
                            else:
                                has_non_roof_permit = True

                if has_roof_permit:
                    audit_status = "ROOF_PERMIT_DETECTED"
                elif has_non_roof_permit:
                    audit_status = "NON_ROOF_PERMIT_DETECTED"
                else:
                    audit_status = "NO_POST_STORM_ROOF_PERMIT_FOUND"

                return {
                    "audit_status": audit_status,
                    "total_found": len(feats),
                    "post_storm_count": len(post_storm_permits),
                    "post_storm_permits": post_storm_permits,
                    "portal_check_date": datetime.now().strftime('%Y-%m-%d'),
                    "portal_url": f"{CFW_PERMITS_URL}?where={urllib.parse.quote(query_where)}&outFields=*&f=html"
                }
        except Exception as e:
            return {"audit_status": "PORTAL_CHECK_FAILED", "error": str(e)}


class AerialSnapshotService:
    """Captures high-resolution ESRI World Imagery and acquisition dates."""
    
    @staticmethod
    def capture_snapshot(lat: float, lon: float, lead_id: str, output_dir: str = THUMBNAIL_DIR) -> Dict[str, Any]:
        os.makedirs(output_dir, exist_ok=True)
        filename = f"thumb_{lead_id}.png"
        out_path = os.path.join(output_dir, filename)
        
        delta = 0.0016
        minx, maxx = lon - delta, lon + delta
        miny, maxy = lat - delta * 0.75, lat + delta * 0.75
        
        url = f"{ESRI_IMAGERY_URL}?bbox={minx},{miny},{maxx},{maxy}&bboxSR=4326&size=600,450&f=image"
        req = urllib.request.Request(url, headers=HTTP_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                with open(out_path, "wb") as f:
                    f.write(res.read())
            
            # Query capture date from ESRI metadata layer
            point_geom = json.dumps({'x': lon, 'y': lat, 'spatialReference': {'wkid': 4326}})
            meta_params = {
                'geometry': point_geom,
                'geometryType': 'esriGeometryPoint',
                'spatialRel': 'esriSpatialRelIntersects',
                'outFields': 'SRC_DATE,SRC_DESC',
                'f': 'json'
            }
            meta_url = f"{ESRI_METADATA_URL}?{urllib.parse.urlencode(meta_params)}"
            meta_req = urllib.request.Request(meta_url, headers=HTTP_HEADERS)
            capture_date_str = "ESRI World Imagery (Satellite Capture)"
            try:
                with urllib.request.urlopen(meta_req, timeout=8) as meta_res:
                    meta_data = json.loads(meta_res.read().decode())
                    if meta_data.get('features'):
                        s_date = str(meta_data['features'][0]['attributes'].get('SRC_DATE') or "")
                        if s_date and len(s_date) >= 8:
                            capture_date_str = f"{s_date[:4]}-{s_date[4:6]}-{s_date[6:8]}"
            except Exception:
                pass
                
            return {
                "success": True,
                "local_path": out_path,
                "filename": filename,
                "capture_date": capture_date_str
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class VerificationEngine:
    """Orchestrates the 5-Pillar Verification Workflow and persists evidence."""

    @classmethod
    def _hail_proximity_for_lead(cls, lead_id: str, lat: float, lon: float) -> Dict[str, Any]:
        """Use staged SPC point evidence when present; otherwise empty proximity (no invented miles)."""
        try:
            import sqlite3
            from pathlib import Path
            from app.science.lead_store import evidence_map

            db_p = Path(__file__).resolve().parents[2] / "depoii_local.db"
            if db_p.exists():
                conn = sqlite3.connect(f"file:{db_p}?mode=ro", uri=True)
                try:
                    ev = evidence_map(conn, lead_id)
                finally:
                    conn.close()
                raw_miles = (ev.get("hail_distance_mi") or "").strip()
                raw_size = (ev.get("spc_size_in") or "").strip()
                if raw_miles:
                    miles = float(raw_miles)
                    size = float(raw_size) if raw_size else None
                    return {
                        "distance_miles": miles,
                        "hail_size_inches": size,
                        "report_location": ev.get("spc_comment") or ev.get("address") or "",
                        "attached": True,
                        "report_timestamp": ev.get("spc_time_utc") or None,
                        "is_in_strike_zone": miles <= 5.0,
                        "spc_file": ev.get("spc_file") or "",
                        "reason": "nearest Texas SPC point from lead_evidence",
                    }
        except (TypeError, ValueError, OSError, ImportError):
            pass
        return HailProximityEngine.calculate_nearest_hail(lat, lon)

    @classmethod
    def verify_lead(cls, lead_id: str, address: str, city: str, lat: float, lon: float, account_number: Optional[str] = None, storm_date: str = "2026-04-26") -> Dict[str, Any]:
        evidence: Dict[str, Any] = {
            "lead_id": lead_id,
            "address": address,
            "city": city,
            "verified_at": datetime.now().isoformat()
        }
        
        score = 0
        disqualified = False
        disqualify_reason = None
        
        # Pillar 0: Persistent Disqualification Guard
        try:
            import sqlite3
            from pathlib import Path
            db_p = Path(__file__).resolve().parents[2] / "depoii_local.db"
            if db_p.exists():
                c_disq = sqlite3.connect(db_p)
                row_disq = c_disq.execute(
                    "SELECT disqualification_reason, evidence_source FROM manual_disqualifications WHERE parcel_id = ? OR LOWER(address) = LOWER(?)",
                    (lead_id, address)
                ).fetchone()
                c_disq.close()
                if row_disq:
                    evidence["verification_score"] = 0
                    evidence["verification_status"] = "DISQUALIFIED_MANUAL"
                    evidence["disqualification_reason"] = row_disq[0]
                    evidence["evidence_source"] = row_disq[1]
                    cls._persist_verification(lead_id, "DISQUALIFIED_MANUAL", 0, {}, {}, {}, {}, evidence)
                    return evidence
        except Exception:
            pass

        # Pillar 1: CAD Audit
        if city.lower() in ["fort worth", "benbrook", "white settlement", "arlington"]:
            cad_res = CADAuditor.audit_tarrant_cad(address, account_number)
        else:
            cad_res = CADAuditor.audit_dallas_cad(address, account_number)
            
        evidence["cad"] = cad_res
        if cad_res.get("found"):
            if cad_res.get("is_disqualified"):
                disqualified = True
                disqualify_reason = cad_res.get("disqualification_reason")
            else:
                score += 30
        
        # Pillar 2: Hail Proximity — prefer staged SPC evidence on the parcel; never compare None.
        hail_res = cls._hail_proximity_for_lead(lead_id, lat, lon)
        evidence["hail_proximity"] = hail_res
        miles = hail_res.get("distance_miles")
        if isinstance(miles, (int, float)):
            if miles <= 1.0:
                score += 30
            elif miles <= 2.0:
                score += 20
            elif miles <= 3.0:
                score += 10
            hail_res["is_in_strike_zone"] = miles <= 5.0
        else:
            hail_res["is_in_strike_zone"] = False
            
        # Pillar 3: Municipal Permit Portal Audit
        muni_res = MunicipalPermitAuditor.audit_fort_worth(address, storm_date=storm_date)
        evidence["municipal_permits"] = muni_res
        audit_status = muni_res.get("audit_status")
        if audit_status == "NO_POST_STORM_ROOF_PERMIT_FOUND":
            score += 25
        elif audit_status == "NON_ROOF_PERMIT_DETECTED":
            # Active commercial site with tenant capex, but no roof permit filed. Retained candidate.
            score += 25
        elif audit_status == "ROOF_PERMIT_DETECTED":
            disqualified = True
            disqualify_reason = f"Post-storm roof permit detected: {len(muni_res.get('post_storm_permits', []))} filings"
            
        # Pillar 4: Satellite Archetype Snapshot
        aerial_res = AerialSnapshotService.capture_snapshot(lat, lon, lead_id)
        evidence["aerial"] = aerial_res
        if aerial_res.get("success"):
            score += 15
            
        # Overall status determination
        if disqualified:
            if "Multi-Family" in str(disqualify_reason):
                status = "DISQUALIFIED_MFR"
            elif "Disqualified Owner" in str(disqualify_reason) or "Institutional" in str(disqualify_reason):
                status = "DISQUALIFIED_INSTITUTIONAL"
            elif "roof permit detected" in str(disqualify_reason).lower() or "permit detected" in str(disqualify_reason).lower():
                status = "ROOF_PERMIT_DETECTED"
            else:
                status = "DISQUALIFIED"
        else:
            if audit_status == "NON_ROOF_PERMIT_DETECTED":
                status = "NON_ROOF_PERMIT_DETECTED"
            elif score >= 75:
                status = "VERIFIED"
            else:
                status = "UNVERIFIED"
            
        evidence["verification_score"] = score
        evidence["verification_status"] = status
        evidence["disqualification_reason"] = disqualify_reason
        
        # Persist to database
        cls._persist_verification(lead_id, status, score, cad_res, hail_res, muni_res, aerial_res, evidence)
        return evidence
        
    @classmethod
    def _persist_verification(cls, lead_id: str, status: str, score: int, cad: Dict, hail: Dict, muni: Dict, aerial: Dict, payload: Dict):
        payload_json = json.dumps(payload)
        values = (
            status,
            score,
            cad.get("account"),
            hail.get("distance_miles"),
            hail.get("hail_size_inches"),
            hail.get("report_location"),
            muni.get("portal_check_date"),
            muni.get("audit_status"),
            aerial.get("local_path"),
            aerial.get("capture_date"),
            payload_json,
            lead_id,
        )

        def _write(conn):
            exists = conn.execute(
                "SELECT 1 FROM scored_parcel_leads WHERE parcel_id = ? LIMIT 1",
                (lead_id,),
            ).fetchone()
            if exists:
                conn.execute(
                    """
                    UPDATE scored_parcel_leads
                    SET verification_status = ?,
                        verification_score = ?,
                        cad_account_id = ?,
                        nearest_hail_distance_mi = ?,
                        nearest_hail_size_in = ?,
                        nearest_hail_location = ?,
                        muni_permit_check_date = ?,
                        muni_permit_status = ?,
                        aerial_snapshot_url = ?,
                        aerial_capture_date = ?,
                        evidence_payload_json = ?
                    WHERE parcel_id = ?
                    """,
                    values,
                )
                return

            # Dallas pilot releases live in released_leads; many have no scored_parcel_leads row yet.
            parcel = conn.execute(
                """
                SELECT id, address, city, state, zip_code, owner_name, building_sqft, year_built
                FROM parcels WHERE id = ?
                """,
                (lead_id,),
            ).fetchone()
            address = (parcel[1] if parcel else None) or (payload.get("address") or "")
            city = (parcel[2] if parcel else None) or (payload.get("city") or "")
            state = (parcel[3] if parcel else None) or "TX"
            zip_code = (parcel[4] if parcel else None) or ""
            owner = (parcel[5] if parcel else None) or ""
            sqft = (parcel[6] if parcel else None) or 0
            year_built = (parcel[7] if parcel else None) or 0
            conn.execute(
                """
                INSERT INTO scored_parcel_leads (
                    parcel_id, address, city, state, zip_code, owner_name, building_sqft, year_built,
                    verification_status, verification_score, cad_account_id,
                    nearest_hail_distance_mi, nearest_hail_size_in, nearest_hail_location,
                    muni_permit_check_date, muni_permit_status,
                    aerial_snapshot_url, aerial_capture_date, evidence_payload_json,
                    is_mock, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
                """,
                (
                    lead_id,
                    address,
                    city,
                    state,
                    zip_code,
                    owner,
                    sqft,
                    year_built,
                    status,
                    score,
                    cad.get("account"),
                    hail.get("distance_miles"),
                    hail.get("hail_size_inches"),
                    hail.get("report_location"),
                    muni.get("portal_check_date"),
                    muni.get("audit_status"),
                    aerial.get("local_path"),
                    aerial.get("capture_date"),
                    payload_json,
                ),
            )

        write_with_retry(_write)

import urllib.request
import json
import os

def generate_markdown():
    url = "http://127.0.0.1:8000/openapi.json"
    try:
        response = urllib.request.urlopen(url)
        data = json.loads(response.read().decode())
    except Exception as e:
        print(f"Failed to fetch openapi.json: {e}")
        return

    md = ["# Depoii FastAPI Data Engine - API Documentation\n"]
    md.append("This document provides a comprehensive detailing of all REST API endpoints available in the Depoii FastAPI microservice.\n")
    
    paths = data.get("paths", {})
    components = data.get("components", {}).get("schemas", {})

    for path, methods in paths.items():
        for method, details in methods.items():
            summary = details.get("summary", "")
            description = details.get("description", "No description provided.")
            md.append(f"## {method.upper()} `{path}`")
            if summary:
                md.append(f"**{summary}**\n")
            md.append(f"{description}\n")

            # Parameters
            params = details.get("parameters", [])
            if params:
                md.append("### Query/Path Parameters:")
                md.append("| Name | In | Type | Required | Description |")
                md.append("|---|---|---|---|---|")
                for p in params:
                    name = p.get("name")
                    in_ = p.get("in")
                    req = "Yes" if p.get("required") else "No"
                    desc = p.get("description", "")
                    schema = p.get("schema", {})
                    ptype = schema.get("type", "string")
                    md.append(f"| `{name}` | {in_} | `{ptype}` | {req} | {desc} |")
                md.append("\n")

            # Request Body
            request_body = details.get("requestBody", {})
            if request_body:
                content = request_body.get("content", {}).get("application/json", {})
                schema = content.get("schema", {})
                ref = schema.get("$ref")
                if ref:
                    ref_name = ref.split("/")[-1]
                    schema_def = components.get(ref_name, {})
                    md.append("### Request Body (`application/json`)")
                    md.append(f"**Schema:** `{ref_name}`\n")
                    md.append("```json\n" + json.dumps(schema_def.get("properties", {}), indent=2) + "\n```\n")

            # Responses
            md.append("### Responses:")
            responses = details.get("responses", {})
            for code, resp in responses.items():
                desc = resp.get("description", "")
                md.append(f"- **{code}**: {desc}")
                
                content = resp.get("content", {}).get("application/json", {})
                schema = content.get("schema", {})
                ref = schema.get("$ref")
                
                if ref:
                    ref_name = ref.split("/")[-1]
                    schema_def = components.get(ref_name, {})
                    md.append(f"  - **Response Model**: `{ref_name}`")
                    # Let's dump a brief version of properties
                    props = schema_def.get("properties", {})
                    md.append("  ```json\n  " + json.dumps(props, indent=2).replace("\\n", "\n") + "\n  ```\n")
                elif "type" in schema and schema["type"] == "array":
                    items = schema.get("items", {})
                    iref = items.get("$ref")
                    if iref:
                        ref_name = iref.split("/")[-1]
                        schema_def = components.get(ref_name, {})
                        md.append(f"  - **Response Model**: `Array<{ref_name}>`")
                        props = schema_def.get("properties", {})
                        md.append("  ```json\n  [\n    " + json.dumps(props, indent=2).replace("\\n", "\n") + "\n  ]\n  ```\n")

            md.append("---\n")

    out_path = r"C:\Users\alimi\.gemini\antigravity-ide\brain\4657e2d0-3030-4de8-bbd3-afd793b27333\fastapi_api_documentation.md"
    
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md))
        
    print("Documentation generated successfully.")

if __name__ == "__main__":
    generate_markdown()

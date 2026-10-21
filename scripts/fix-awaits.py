import pathlib

fixes = {
    "src/app/api/auth/invite/route.ts": [("const result = acceptTeamInvite(", "const result = await acceptTeamInvite(")],
    "src/app/api/auth/enter/route.ts": [("const result = redeemLoginLink(", "const result = await redeemLoginLink(")],
    "src/app/api/auth/signup/route.ts": [("const result = signUp(", "const result = await signUp(")],
    "src/app/api/auth/login/route.ts": [("const result = verifyLoginOtp(", "const result = await verifyLoginOtp(")],
    "src/app/api/auth/reps/route.ts": [
        ("members: listOrgMembers(", "members: await listOrgMembers("),
        ("invites: listPendingInvites(", "invites: await listPendingInvites("),
        ("const result = cancelTeamInvite(", "const result = await cancelTeamInvite("),
    ],
    "src/app/api/admin/users/route.ts": [
        ("return Response.json(listUsers())", "return Response.json(await listUsers())"),
        ("return Response.json(createMember(actor.id, body), { status: 201 })", "return Response.json(await createMember(actor.id, body), { status: 201 })"),
    ],
    "src/app/api/admin/orgs/route.ts": [
        ("return Response.json(listOrgs())", "return Response.json(await listOrgs())"),
        ("return Response.json(createOrganization(actor.id, body), { status: 201 })", "return Response.json(await createOrganization(actor.id, body), { status: 201 })"),
    ],
    "src/app/api/admin/overview/route.ts": [("return Response.json(overview())", "return Response.json(await overview())")],
    "src/app/api/admin/activity/route.ts": [("return Response.json(listActivity({", "return Response.json(await listActivity({")],
    "src/app/api/outcomes/route.ts": [
        ("return Response.json(listOutcomes(user.orgId))", "return Response.json(await listOutcomes(user.orgId))"),
        ("saveOutcomes(outcomes, user.orgId);", "await saveOutcomes(outcomes, user.orgId);"),
        ("clearOutcomes(user.orgId);", "await clearOutcomes(user.orgId);"),
    ],
    "src/app/api/permits/[id]/contacts/route.ts": [("const cached = readPermitContacts(decodedId);", "const cached = await readPermitContacts(decodedId);")],
    "src/lib/live/load.ts": [("  persistLive(payload);", "  await persistLive(payload);")],
    "src/proxy.ts": [
        ("export function proxy(request: NextRequest) {", "export async function proxy(request: NextRequest) {"),
        ("const session = readSessionToken(", "const session = await readSessionToken("),
    ],
    "src/app/api/admin/users/[id]/route.ts": [
        ("return Response.json(userDetail(id))", "return Response.json(await userDetail(id))"),
        ("return Response.json(updateMember(actor.id, id, body))", "return Response.json(await updateMember(actor.id, id, body))"),
    ],
    "src/app/api/admin/orgs/[id]/route.ts": [
        ("return Response.json(organizationDetail(id))", "return Response.json(await organizationDetail(id))"),
        ("return Response.json(updateOrganization(actor.id, id, body))", "return Response.json(await updateOrganization(actor.id, id, body))"),
    ],
}

for path, pairs in fixes.items():
    p = pathlib.Path(path)
    if not p.exists():
        print("missing", path)
        continue
    s = p.read_text(encoding="utf8")
    for a, b in pairs:
        if a not in s:
            print("NOTFOUND", path, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf8")
print("done")

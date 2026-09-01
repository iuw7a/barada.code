import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCname } from "dns/promises";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { cnameTarget, ROOT_DOMAIN } from "@/lib/projects/publish";

const Body = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i, "Invalid domain")
    .transform((d) => d.toLowerCase().trim()),
});

/**
 * POST — attach (or replace) a custom domain for the published project.
 * The domain is stored unverified; call PUT to verify DNS.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "ADMIN");

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid domain");
    const domain = parsed.data.domain;

    const deployment = await prisma.deployment.findUnique({ where: { projectId: id } });
    if (!deployment) throw new ApiError(400, "Publish the project first");

    const taken = await prisma.deployment.findFirst({
      where: { customDomain: domain, NOT: { projectId: id } },
      select: { id: true },
    });
    if (taken) throw new ApiError(409, "This domain is already in use");

    const updated = await prisma.deployment.update({
      where: { id: deployment.id },
      data: { customDomain: domain, domainVerifiedAt: null },
    });
    return NextResponse.json({
      deployment: updated,
      cnameTarget: cnameTarget(deployment.subdomain),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/**
 * PUT — verify the custom domain's DNS: its CNAME must point at
 * {subdomain}.{ROOT_DOMAIN}. Real DNS lookup, no mock.
 */
export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "ADMIN");

    const deployment = await prisma.deployment.findUnique({ where: { projectId: id } });
    if (!deployment?.customDomain) throw new ApiError(400, "No custom domain configured");

    const expected = cnameTarget(deployment.subdomain);
    let verified = false;
    try {
      const names = await resolveCname(deployment.customDomain);
      verified = names.some((n) => n.toLowerCase() === expected);
    } catch {
      verified = false;
    }
    if (!verified) {
      throw new ApiError(
        400,
        `DNS not verified yet — point a CNAME record for ${deployment.customDomain} at ${expected} (can take minutes to propagate)`
      );
    }

    const updated = await prisma.deployment.update({
      where: { id: deployment.id },
      data: { domainVerifiedAt: new Date() },
    });
    return NextResponse.json({ deployment: updated, verified: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE — remove the custom domain. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "ADMIN");

    const deployment = await prisma.deployment.findUnique({ where: { projectId: id } });
    if (!deployment) throw new ApiError(404, "Not published");
    const updated = await prisma.deployment.update({
      where: { id: deployment.id },
      data: { customDomain: null, domainVerifiedAt: null },
    });
    void ROOT_DOMAIN;
    return NextResponse.json({ deployment: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

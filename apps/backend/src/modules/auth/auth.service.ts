import { randomUUID } from "node:crypto";

import { WorkspaceRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

import type { LoginInput, RegisterInput } from "./auth.schema.js";

import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshExpiry,
} from "./auth.token.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
} as const;

function createSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "workspace";
}

async function createSession(user: { id: string; email: string }) {
  const accessToken = await createAccessToken({
    userId: user.id,
    email: user.email,
  });

  const refreshToken = createRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry(),
    },
  });

  return {
    accessToken,
    refreshToken,
  };
}

export async function register(input: RegisterInput) {
  const exists = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    select: {
      id: true,
    },
  });

  if (exists) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const suffix = randomUUID().slice(0, 8);
  const workspaceSlug = `${createSlug(input.name)}-${suffix}`;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
      select: publicUserSelect,
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `${input.name}'s Workspace`,
        slug: workspaceSlug,
        memberships: {
          create: {
            userId: created.id,
            role: WorkspaceRole.OWNER,
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return {
      ...created,
      workspaces: [
        {
          ...workspace,
          role: WorkspaceRole.OWNER,
        },
      ],
    };
  });

  const session = await createSession(user);

  return {
    user,
    ...session,
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    select: {
      ...publicUserSelect,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };

  const session = await createSession(safeUser);

  return {
    user: safeUser,
    ...session,
  };
}

export async function refresh(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);

  const session = await prisma.refreshToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: {
        select: publicUserSelect,
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw new ApiError(401, "Refresh session is invalid or expired");
  }

  const nextRefreshToken = createRefreshToken();
  const nextHash = hashRefreshToken(nextRefreshToken);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: new Date(),
      },
    }),

    prisma.refreshToken.create({
      data: {
        userId: session.userId,
        tokenHash: nextHash,
        expiresAt: refreshExpiry(),
      },
    }),
  ]);

  return {
    user: session.user,
    accessToken: await createAccessToken({
      userId: session.user.id,
      email: session.user.email,
    }),
    refreshToken: nextRefreshToken,
  };
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashRefreshToken(rawToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      ...publicUserSelect,
      memberships: {
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User was not found");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    workspaces: user.memberships.map(({ role, workspace }) => ({
      ...workspace,
      role,
    })),
  };
}

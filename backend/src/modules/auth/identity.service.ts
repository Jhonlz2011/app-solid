import { v7 as uuidv7 } from 'uuid';
import { eq, and } from '@app/schema';
import { authUsers, account } from '@app/schema/tables';
import type { Tx } from '../../core/db';

export type CreateCredentialIdentityInput = {
  id?: string;
  name: string;
  email: string;
  username: string;
  displayUsername?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  companyId?: number | null;
};

/**
 * Single write boundary for Better Auth credential identities created by
 * transactional provisioning/admin flows. Public sign-up still uses the same
 * Better Auth password configuration through this boundary.
 */
export async function createCredentialIdentity(tx: Tx, input: CreateCredentialIdentityInput) {
  const [createdUser] = await tx
    .insert(authUsers)
    .values({
      id: input.id ?? uuidv7(),
      name: input.name,
      email: input.email,
      username: input.username,
      displayUsername: input.displayUsername ?? input.name,
      company_id: input.companyId ?? null,
      is_active: true,
      emailVerified: input.emailVerified ?? false,
    })
    .returning({
      id: authUsers.id,
      username: authUsers.username,
      email: authUsers.email,
      is_active: authUsers.is_active,
      last_login: authUsers.last_login,
      emailVerified: authUsers.emailVerified,
    });

  if (input.passwordHash) {
    await ensureCredentialAccount(tx, createdUser.id, input.passwordHash);
  }
  return createdUser;
}

/** Creates the credential account only when the user does not already have one. */
export async function ensureCredentialAccount(tx: Tx, userId: string, passwordHash: string) {
  const existing = await tx.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, 'credential')),
  });

  if (existing) return existing;

  const [created] = await tx
    .insert(account)
    .values({
      id: uuidv7(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: passwordHash,
    })
    .returning();
  return created;
}

/** Replaces credentials only in explicit recovery/invitation activation flows. */
export async function replaceCredentialPassword(tx: Tx, userId: string, passwordHash: string) {
  const existing = await tx.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, 'credential')),
  });

  if (existing) {
    await tx
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(account.id, existing.id));
    return;
  }

  await ensureCredentialAccount(tx, userId, passwordHash);
}

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDatabase, schema as s } from '@portl/database';
const input = z
  .object({
    DATABASE_URL: z.string().min(1),
    BOOTSTRAP_ADMIN_EMAIL: z.email().toLowerCase(),
    BOOTSTRAP_ADMIN_NAME: z.string().min(2),
    BOOTSTRAP_SOCIETY_NAME: z.string().min(2),
    BOOTSTRAP_SOCIETY_CODE: z.string().regex(/^[A-Z0-9]{4,20}$/),
    BOOTSTRAP_CITY: z.string().min(2),
  })
  .parse(process.env);
const { db, pool } = createDatabase(input.DATABASE_URL);
try {
  const societyId = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(s.societies)
      .where(eq(s.societies.code, input.BOOTSTRAP_SOCIETY_CODE));
    if (existing)
      throw new Error('Society code already exists. Bootstrap only creates new societies.');
    await tx
      .insert(s.user)
      .values({
        id: randomUUID(),
        name: input.BOOTSTRAP_ADMIN_NAME,
        email: input.BOOTSTRAP_ADMIN_EMAIL,
        emailVerified: false,
      })
      .onConflictDoNothing();
    const [user] = await tx
      .select()
      .from(s.user)
      .where(eq(s.user.email, input.BOOTSTRAP_ADMIN_EMAIL));
    const [society] = await tx
      .insert(s.societies)
      .values({
        name: input.BOOTSTRAP_SOCIETY_NAME,
        code: input.BOOTSTRAP_SOCIETY_CODE,
        city: input.BOOTSTRAP_CITY,
      })
      .returning();
    await tx
      .insert(s.memberships)
      .values({ societyId: society!.id, userId: user!.id, roles: ['admin'] });
    return society!.id;
  });
  console.info(
    `Society ${societyId} created. The administrator must verify their email through normal OTP sign-in.`,
  );
} finally {
  await pool.end();
}

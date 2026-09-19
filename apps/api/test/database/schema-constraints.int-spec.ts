import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { profiles } from '../../src/database/schema/identity';
import {
  maintenances,
  parts,
  tasks,
  taskTypes,
  workshops,
} from '../../src/database/schema/maintenance';
import { odometerReadings } from '../../src/database/schema/odometer';
import { vehicleTaskSchedules } from '../../src/database/schema/reminders';
import { vehicles } from '../../src/database/schema/vehicles';
import { startTestPostgres } from '../support/postgres';
import type { TestDatabase, TestPostgres } from '../support/postgres';

let postgres: TestPostgres;
let db: TestDatabase;

beforeAll(async () => {
  postgres = await startTestPostgres();
  db = postgres.db;
});

afterAll(async () => {
  // Optional chaining: if the container never started, the real error is the
  // one from beforeAll, and a second one from here would only bury it.
  await postgres?.stop();
});

beforeEach(async () => {
  // Deleting profiles and the shared catalog clears everything else through
  // the cascades. If a future table survives this, its cascade is wrong.
  await db.delete(profiles);
  await db.delete(taskTypes);
});

async function insertProfile(authSubject: string): Promise<string> {
  const [row] = await db
    .insert(profiles)
    .values({ authSubject })
    .returning({ id: profiles.id });

  return row!.id;
}

async function insertVehicle(
  profileId: string,
  overrides: { plate?: string; vin?: string | null } = {},
): Promise<string> {
  const [row] = await db
    .insert(vehicles)
    .values({
      profileId,
      make: 'Seat',
      model: 'León',
      plate: overrides.plate ?? '1234ABC',
      vin: overrides.vin ?? null,
    })
    .returning({ id: vehicles.id });

  return row!.id;
}

async function insertSharedTaskType(name: string): Promise<string> {
  const [row] = await db
    .insert(taskTypes)
    .values({ name, intervalKm: 15000, intervalMonths: 12 })
    .returning({ id: taskTypes.id });

  return row!.id;
}

/**
 * The name of the constraint a statement violated.
 *
 * Drizzle wraps driver errors, and its message is the failed SQL rather than
 * the reason. The constraint name is the reason, and PostgreSQL puts it on the
 * error it raises — so the assertion reads the field instead of matching text
 * that is not there.
 */
async function violatedConstraint(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
  } catch (error) {
    const cause = (error as { cause?: { constraint?: string } }).cause;

    if (cause?.constraint) {
      return cause.constraint;
    }

    throw error;
  }

  throw new Error('Expected the statement to be rejected, but it succeeded.');
}

describe('vehicle identification', () => {
  it('rejects the same plate twice within one profile', async () => {
    const profileId = await insertProfile('auth|plate-owner');
    await insertVehicle(profileId, { plate: '1234ABC' });

    expect(
      await violatedConstraint(insertVehicle(profileId, { plate: '1234ABC' })),
    ).toBe('vehicles_profile_plate_unique');
  });

  it('accepts the same plate in two different profiles', async () => {
    // A car changed hands, or a couple both track the family car. Global
    // uniqueness would let whoever registered first block the plate forever.
    const seller = await insertProfile('auth|seller');
    const buyer = await insertProfile('auth|buyer');

    await insertVehicle(seller, { plate: '1234ABC' });

    await expect(
      insertVehicle(buyer, { plate: '1234ABC' }),
    ).resolves.toEqual(expect.any(String));
  });

  it('rejects the same VIN twice within one profile', async () => {
    const profileId = await insertProfile('auth|vin-owner');
    await insertVehicle(profileId, {
      plate: '1111AAA',
      vin: 'VF1RFA00X12345678',
    });

    expect(
      await violatedConstraint(
        insertVehicle(profileId, { plate: '2222BBB', vin: 'VF1RFA00X12345678' }),
      ),
    ).toBe('vehicles_profile_vin_unique');
  });

  it('accepts many vehicles without a VIN in one profile', async () => {
    // The VIN is optional, so its uniqueness applies only when present. A
    // plain unique index would be enough in PostgreSQL, where NULLs are
    // distinct, but the partial index states the rule instead of relying on it.
    const profileId = await insertProfile('auth|no-vin');

    await insertVehicle(profileId, { plate: '1111AAA', vin: null });

    await expect(
      insertVehicle(profileId, { plate: '2222BBB', vin: null }),
    ).resolves.toEqual(expect.any(String));
  });
});

describe('odometer readings', () => {
  it('accepts a reading lower than the previous one', async () => {
    // A decrease is a domain warning, not a database error: the common case is
    // a typo, and cluster replacement and imports are legitimate. Enforcing
    // monotonicity here would trap someone who typed 150000 instead of 15000.
    const profileId = await insertProfile('auth|rollback');
    const vehicleId = await insertVehicle(profileId);

    await db.insert(odometerReadings).values({
      vehicleId,
      kilometers: 150_000,
      recordedAt: new Date('2026-01-01T10:00:00Z'),
      source: 'manual',
    });

    await expect(
      db.insert(odometerReadings).values({
        vehicleId,
        kilometers: 15_000,
        recordedAt: new Date('2026-02-01T10:00:00Z'),
        source: 'manual',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a negative reading', async () => {
    const profileId = await insertProfile('auth|negative');
    const vehicleId = await insertVehicle(profileId);

    expect(
      await violatedConstraint(
        db.insert(odometerReadings).values({
          vehicleId,
          kilometers: -1,
          recordedAt: new Date(),
          source: 'manual',
        }),
      ),
    ).toBe('odometer_readings_kilometers_non_negative');
  });

  it('rejects a manual reading that points at a maintenance', async () => {
    const profileId = await insertProfile('auth|mislabelled');
    const vehicleId = await insertVehicle(profileId);
    const [maintenance] = await db
      .insert(maintenances)
      .values({
        vehicleId,
        performedAt: new Date('2026-03-01T09:00:00Z'),
        performedBy: 'self',
      })
      .returning({ id: maintenances.id });

    expect(
      await violatedConstraint(
        db.insert(odometerReadings).values({
          vehicleId,
          kilometers: 42_000,
          recordedAt: new Date(),
          source: 'manual',
          maintenanceId: maintenance!.id,
        }),
      ),
    ).toBe('odometer_readings_maintenance_link');
  });

  it('rejects a maintenance reading with no maintenance', async () => {
    const profileId = await insertProfile('auth|orphan-reading');
    const vehicleId = await insertVehicle(profileId);

    expect(
      await violatedConstraint(
        db.insert(odometerReadings).values({
          vehicleId,
          kilometers: 42_000,
          recordedAt: new Date(),
          source: 'maintenance',
        }),
      ),
    ).toBe('odometer_readings_maintenance_link');
  });
});

describe('the task type catalog', () => {
  it('rejects two shared entries with the same name', async () => {
    await insertSharedTaskType('Oil change');

    expect(await violatedConstraint(insertSharedTaskType('Oil change'))).toBe(
      'task_types_shared_name_unique',
    );
  });

  it('lets a profile add a task with the same name as a shared one', async () => {
    // profileId null means shared, a value means private to that profile. The
    // two namespaces are independent on purpose: one table, one behaviour.
    await insertSharedTaskType('Oil change');
    const profileId = await insertProfile('auth|own-task');

    await expect(
      db.insert(taskTypes).values({ profileId, name: 'Oil change' }),
    ).resolves.toBeDefined();
  });

  it('rejects two entries with the same name within one profile', async () => {
    const profileId = await insertProfile('auth|duplicate-task');
    await db.insert(taskTypes).values({ profileId, name: 'Coolant flush' });

    expect(
      await violatedConstraint(
        db.insert(taskTypes).values({ profileId, name: 'Coolant flush' }),
      ),
    ).toBe('task_types_profile_name_unique');
  });

  it('refuses to delete a task type that history refers to', async () => {
    // Deleting the catalog entry would erase what the work actually was.
    const profileId = await insertProfile('auth|used-task');
    const vehicleId = await insertVehicle(profileId);
    const taskTypeId = await insertSharedTaskType('Timing belt');
    const [maintenance] = await db
      .insert(maintenances)
      .values({
        vehicleId,
        performedAt: new Date('2026-04-01T09:00:00Z'),
        performedBy: 'self',
      })
      .returning({ id: maintenances.id });

    await db
      .insert(tasks)
      .values({ maintenanceId: maintenance!.id, taskTypeId });

    expect(
      await violatedConstraint(
        db.delete(taskTypes).where(eq(taskTypes.id, taskTypeId)),
      ),
    ).toBe('tasks_task_type_id_task_types_id_fk');
  });
});

describe('maintenance', () => {
  it('rejects self-performed work attributed to a workshop', async () => {
    const profileId = await insertProfile('auth|self-work');
    const vehicleId = await insertVehicle(profileId);
    const [workshop] = await db
      .insert(workshops)
      .values({ profileId, name: 'Talleres Pepe' })
      .returning({ id: workshops.id });

    expect(
      await violatedConstraint(
        db.insert(maintenances).values({
          vehicleId,
          performedAt: new Date(),
          performedBy: 'self',
          workshopId: workshop!.id,
        }),
      ),
    ).toBe('maintenances_workshop_only_when_workshop_performed');
  });

  it('keeps the maintenance when its workshop is deleted', async () => {
    // The visit happened. Losing the history because the workshop record went
    // away would be losing a fact about the past.
    const profileId = await insertProfile('auth|closed-workshop');
    const vehicleId = await insertVehicle(profileId);
    const [workshop] = await db
      .insert(workshops)
      .values({ profileId, name: 'Talleres Pepe' })
      .returning({ id: workshops.id });

    const [maintenance] = await db
      .insert(maintenances)
      .values({
        vehicleId,
        performedAt: new Date(),
        performedBy: 'workshop',
        workshopId: workshop!.id,
      })
      .returning({ id: maintenances.id });

    await db.delete(workshops).where(eq(workshops.id, workshop!.id));

    const [survivor] = await db
      .select()
      .from(maintenances)
      .where(eq(maintenances.id, maintenance!.id));

    expect(survivor).toMatchObject({
      performedBy: 'workshop',
      workshopId: null,
    });
  });

  it('stores a total cost with two decimals and no floating point drift', async () => {
    const profileId = await insertProfile('auth|cost');
    const vehicleId = await insertVehicle(profileId);

    const [maintenance] = await db
      .insert(maintenances)
      .values({
        vehicleId,
        performedAt: new Date(),
        performedBy: 'workshop',
        totalCost: '320.45',
      })
      .returning({ totalCost: maintenances.totalCost });

    expect(maintenance!.totalCost).toBe('320.45');
  });
});

describe('cascades', () => {
  it('removes everything a profile owns when the profile is deleted', async () => {
    const profileId = await insertProfile('auth|cascade');
    const vehicleId = await insertVehicle(profileId);
    const taskTypeId = await insertSharedTaskType('Oil change');

    const [maintenance] = await db
      .insert(maintenances)
      .values({
        vehicleId,
        performedAt: new Date(),
        performedBy: 'self',
      })
      .returning({ id: maintenances.id });

    const [task] = await db
      .insert(tasks)
      .values({ maintenanceId: maintenance!.id, taskTypeId })
      .returning({ id: tasks.id });

    await db
      .insert(parts)
      .values({ taskId: task!.id, name: 'Mann W712/95', quantity: '1' });

    await db.insert(odometerReadings).values({
      vehicleId,
      kilometers: 42_000,
      recordedAt: new Date(),
      source: 'manual',
    });

    await db
      .insert(vehicleTaskSchedules)
      .values({ vehicleId, taskTypeId, intervalKm: 10_000 });

    await db.delete(profiles).where(eq(profiles.id, profileId));

    expect(await db.select().from(vehicles)).toHaveLength(0);
    expect(await db.select().from(maintenances)).toHaveLength(0);
    expect(await db.select().from(tasks)).toHaveLength(0);
    expect(await db.select().from(parts)).toHaveLength(0);
    expect(await db.select().from(odometerReadings)).toHaveLength(0);
    expect(await db.select().from(vehicleTaskSchedules)).toHaveLength(0);
    // The shared catalog belongs to nobody and outlives every profile.
    expect(await db.select().from(taskTypes)).toHaveLength(1);
  });

  it('deletes a profile whose private task type its own history uses', async () => {
    // Deleting a profile cascades down two paths that meet at the same rows:
    // profile -> task_types, and profile -> vehicles -> maintenances -> tasks.
    // RESTRICT is checked the instant a task type row goes, before the other
    // path has removed the tasks that point at it, so the whole delete fails.
    const profileId = await insertProfile('auth|private-task-in-use');
    const vehicleId = await insertVehicle(profileId);
    const [taskType] = await db
      .insert(taskTypes)
      .values({ profileId, name: 'Custom check', intervalKm: 5_000 })
      .returning({ id: taskTypes.id });

    const [maintenance] = await db
      .insert(maintenances)
      .values({ vehicleId, performedAt: new Date(), performedBy: 'self' })
      .returning({ id: maintenances.id });

    await db
      .insert(tasks)
      .values({ maintenanceId: maintenance!.id, taskTypeId: taskType!.id });
    await db
      .insert(vehicleTaskSchedules)
      .values({ vehicleId, taskTypeId: taskType!.id });

    await db.delete(profiles).where(eq(profiles.id, profileId));

    expect(await db.select().from(taskTypes)).toHaveLength(0);
    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  it('removes the reading a maintenance produced when the maintenance is deleted', async () => {
    const profileId = await insertProfile('auth|maintenance-reading');
    const vehicleId = await insertVehicle(profileId);

    const [maintenance] = await db
      .insert(maintenances)
      .values({
        vehicleId,
        performedAt: new Date(),
        performedBy: 'self',
      })
      .returning({ id: maintenances.id });

    await db.insert(odometerReadings).values({
      vehicleId,
      kilometers: 42_000,
      recordedAt: new Date(),
      source: 'maintenance',
      maintenanceId: maintenance!.id,
    });

    await db.delete(maintenances).where(eq(maintenances.id, maintenance!.id));

    expect(await db.select().from(odometerReadings)).toHaveLength(0);
  });
});

describe('reminder schedules', () => {
  it('rejects following the same task twice on one vehicle', async () => {
    const profileId = await insertProfile('auth|schedule');
    const vehicleId = await insertVehicle(profileId);
    const taskTypeId = await insertSharedTaskType('Oil change');

    await db.insert(vehicleTaskSchedules).values({ vehicleId, taskTypeId });

    expect(
      await violatedConstraint(
        db.insert(vehicleTaskSchedules).values({ vehicleId, taskTypeId }),
      ),
    ).toBe('vehicle_task_schedules_vehicle_task_type_unique');
  });

  it('accepts a schedule with no interval and no baseline', async () => {
    // Every column is an override. With none set, the catalog default applies
    // and the reminder falls back to real task history.
    const profileId = await insertProfile('auth|defaults');
    const vehicleId = await insertVehicle(profileId);
    const taskTypeId = await insertSharedTaskType('Air filter');

    await expect(
      db.insert(vehicleTaskSchedules).values({ vehicleId, taskTypeId }),
    ).resolves.toBeDefined();
  });
});

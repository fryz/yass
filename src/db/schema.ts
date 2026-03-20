import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- Enums ---

export const roleEnum = pgEnum("role", ["admin", "organizer", "user"]);
export const providerEnum = pgEnum("provider", ["auth0", "email_otp"]);
export const selectionLogicEnum = pgEnum("selection_logic", [
  "fcfs",
  "lottery",
  "lottery_preference",
  "fcfs_preference",
]);
export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "open",
  "closed",
  "proposed",
  "finalized",
]);
export const signupStatusEnum = pgEnum("signup_status", [
  "submitted",
  "confirmed",
  "waitlisted",
  "cancelled",
]);
export const proposedStatusEnum = pgEnum("proposed_status", [
  "proposed_confirmed",
  "proposed_waitlisted",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "otp",
  "confirmed",
  "waitlisted",
  "cancelled",
  "event_update",
  "selection_run",
]);

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authProviders = pgTable("auth_providers", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  provider: providerEnum("provider").notNull(),
  providerId: text("provider_id").notNull(), // Auth0 sub or email address
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const forms = pgTable("forms", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // seriesId nullable: null = template form
  seriesId: uuid("series_id"),
  fields: jsonb("fields").notNull(), // FormField[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const eventSeries = pgTable("event_series", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  organizerId: uuid("organizer_id")
    .notNull()
    .references(() => users.id),
  defaultFormId: uuid("default_form_id").references(() => forms.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Add the FK from forms.series_id back to event_series after both are defined
// Drizzle handles circular refs via lazy references; we declare it inline but
// the actual constraint is set up in the migration.

export const events = pgTable("events", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => eventSeries.id),
  name: text("name").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  maxAttendees: integer("max_attendees").notNull(),
  signupClosesAt: timestamp("signup_closes_at").notNull(),
  selectionLogic: selectionLogicEnum("selection_logic").notNull(),
  formId: uuid("form_id").references(() => forms.id), // overrides series default
  status: eventStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const signups = pgTable(
  "signups",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: signupStatusEnum("status").notNull().default("submitted"),
    responses: jsonb("responses").notNull(), // FormResponse
    cancelToken: text("cancel_token").notNull().unique(),
    signedUpAt: timestamp("signed_up_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Partial unique index: prevents duplicate active signups per user per event
    // (allows re-signup after cancellation)
    uniqueIndex("signups_event_user_active_unique")
      .on(table.eventId, table.userId)
      .where(sql`status != 'cancelled'`),
  ]
);

export const signupAttendees = pgTable("signup_attendees", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  signupId: uuid("signup_id")
    .notNull()
    .references(() => signups.id),
  name: text("name").notNull(),
  position: integer("position").notNull(), // 0 = registrant
});

export const signupProposals = pgTable(
  "signup_proposals",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    signupId: uuid("signup_id")
      .notNull()
      .references(() => signups.id),
    proposedStatus: proposedStatusEnum("proposed_status").notNull(),
    runAt: timestamp("run_at").notNull().defaultNow(),
    manuallyAdjusted: boolean("manually_adjusted").notNull().default(false),
  },
  (table) => [
    uniqueIndex("signup_proposals_event_signup_unique").on(
      table.eventId,
      table.signupId
    ),
  ]
);

export const preferencePoints = pgTable(
  "preference_points",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => eventSeries.id),
    points: integer("points").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("preference_points_user_series_unique").on(
      table.userId,
      table.seriesId
    ),
  ]
);

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  otpCode: text("otp_code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => users.id),
  eventId: uuid("event_id").references(() => events.id), // nullable: null for OTP emails
  type: notificationTypeEnum("type").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  novuId: text("novu_id").notNull(), // Novu message ID
});

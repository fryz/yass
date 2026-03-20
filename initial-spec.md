# YASS - Yet Another Simple Signup app

## Motivation

Managing signups for an event can be challenging to do.

The naive attempt is to start with First Come First Serve (FCFS), which can be unfair because:

* It is biased to people who see the signup form early
* It doesn't account for people who might have missed out on the previous event

Trying to solve for these problems adds overhead on the person organizing the event.
Do they need to keep track of everyone who's signed up and not gotten a slot?
Do they need to manage when/how invites are sent out to ask people to not sign up if they've already been?
If so, what happens if the event doesn't fill up?
Do they delay the signups for people who have previously signed up by a week to give new folks time to sign up?

All things being equal, solving for this problem increases the cognitive load on the organizer, which reduces their motivation
and might lead to volunteers not wanting to organize events.

## Goals

* Give organizers of events the ability to sign people up that's fair without increasing cognitive load
* Give users the ability to sign up for events

## Personas

### Organizer

This is the person who is organizing an event. They should be able to do things like:

* Create an event series (name, description, etc.) and create an event for that series (date, # of attendees, etc.)
* Set the information that the users will provide when signing up
* Set the date that signups close
* Manage the attendee list
* Set the selection logic (lottery, FCFS, etc.)
* Send emails/notifications to attendees

### User

This the the person who is signing up for an event. They provide information such as:

* Who they are
* What their contact details are (eg: email, phone, etc.)
* Any other additional information required by the form
* Manage their signups
* View details about their account + events they've attended/signed up for, etc.

### Administrator

This is the person who is administoring the application. They should be able to do things like:

* Manage events + event series
* Manage users + roles
* Extract data from the system (eg: extract CSV of events + participants)
* Send emails/notification to Organizers + Users

## User Stories

### Administrator

- As an Administrator, I want to view and manage all events and event series so that I can oversee activity across the platform.
- As an Administrator, I want to create, edit, and delete event series and events so that I can correct mistakes or remove stale data.
- As an Administrator, I want to manage user accounts so that I can deactivate or update users when needed.
- As an Administrator, I want to assign roles (Administrator, Organizer, User) to accounts so that I can control access levels across the platform.
- As an Administrator, I want to export a CSV of events and their participants so that I can analyze data outside the platform.
- As an Administrator, I want to send emails or notifications to Organizers and Users so that I can communicate platform-wide announcements or changes.

### Organizer

- As an Organizer, I want to create an event series with a name and description so that related events are grouped together.
- As an Organizer, I want to create an event within a series with a date and max attendee count so that users know when and how many slots are available.
- As an Organizer, I want to set a signup close date for an event so that the selection process runs at the right time.
- As an Organizer, I want to choose a selection logic (FCFS, Lottery, Lottery with Preference, FCFS with Preference) for an event so that signups are managed fairly.
- As an Organizer, I want to configure a signup form for an event series, including required fields (name, contact details) and optional additional fields, so that I collect the information I need.
- As an Organizer, I want to set a default form for an event series and override it per event so that I have flexibility without repeating configuration from scratch.
- As an Organizer, I want to choose from pre-built form templates when setting up a form so that I don't have to start from scratch for common event types.
- As an Organizer, I want to view the attendee list for an event so that I know who is coming and who is on the waitlist.
- As an Organizer, I want to manually adjust the attendee or waitlist for an event so that I can handle edge cases (e.g., cancellations).
- As an Organizer, I want to send emails or notifications to attendees and waitlisted users so that I can communicate event details or changes.

### User

- As a User, I want to view available events so that I can decide which ones to sign up for.
- As a User, I want to sign up for an event by filling out a form so that I can register myself (and others I'm bringing) for the event.
- As a User, I want to verify my email address via an email challenge when signing up so that my registration is confirmed and spam is prevented.
- As a User, I want to see my current signups and their status (confirmed, waitlisted) so that I know whether I have a spot.
- As a User, I want to view my preference points for each event series so that I understand my standing in future preference-based selections.
- As a User, I want to view the history of events I have attended so that I can track my participation over time.
- As a User, I want to cancel my signup for an event so that my slot can be given to someone else.

## Features

### Selection Logic

Selection Logic dictates which users will be considered as signed up for an event (vs. being on a waitlist) at the time the event closes.
There should be 4 types of Selection Logic:

1. First Come First Serve (FCFS) - the first users to sign up get slots up until there are no more slots, at which point the rest of the users get added on the waitlist
2. Lottery - all users get put into a pool and users are drawn from the pool until all the slots get filled up, at which point everyone else not selected gets added to the waitlist
3. Lottery with preference - all users get put into a pool. Users have "preference points" for event series, which increase each time they don't get selected to a specific event for
   that event series. First time users have 0 preference points. When a user gets selected to an event, their preference points drop to 0. At selection, users with more preference
   points fill the event first (starting with highest and working down). Users in a group with the same preference points are randomly selected. This continues until the event fills up
   and the rest of the users are added to the waitlist (and preference points increase) or all users are in the event.
4. FCFS with preference - the first users to sign up get slots until there are no more slots. If additional users sign up, if they have more preference points that users on the list,
   they prempt the users on the list (randomly selecting the user from the group of users with the least amount of preference points), or otherwise join the waitlist.

### Form Editing for events

Organizers, when creating an event series + event, should have the ability to configure a simple form that users should fill in.
All forms should be required to capture name of person signing up, name(s) of people attending the event (if multiple people, that's multiple entries), as well as contact details.
Forms can then be configured to gather additional information using simple form inputs.

There should be some sane defaults (basic, etc.) that they can use to import into event series + events that they are creating.
When creating an event series, they can set the default form for all events, but when creating an event in that series they can override and add/remove things.

## Requirements

### AuthN / AuthZ

Administrators + Organizers should be authenticated + authorized using OAuth via some form of social login (Google account).
Administrators should be able to manage roles (eg: Administrator, Organizer, User) in the application.

There should be no authentication for users, but if a user is signing up for an event, there should be an email-challenge to verify that they own the email address
and they aren't a bot.

Users should not be able to see any information other than the events they signed up for (no info on other users, but they can see what they signed up for, how many people signed up,
how many preference points they have for an event series, etc.)

### Deployment

This application will live on Vercel.
Integration with other systems/services (eg: database, usage analytics, potentiall ads, etc.) will all be managed via environment variables.
The database will be a PostgreSQL database (neon) (integration managed by vercel)
The application should be written in typescript and use vercel native dependencies.
The application UI should be written in the vercel-native UX libraries (ShadCN, React, Next.js, Tailwind)
The AuthN/AuthZ service will be Okta's Auth0 (integration managed by vercel)
The usage analytics will be backed by Posthog (integration managed by vercel)
The email integration will be backed by Novu (integration managed by vercel)

# G&P Driver Connect

A mobile-friendly logistics portal for G&P LOGISTICS LLC.

## What works immediately
- Driver and Dispatch demo portals
- Drivers see only their current active load
- Status updates
- POD file selection
- Loaded-freight photo required before delivery details unlock
- Dispatch load creation
- Per-load dispatch packet linking the load photo, POD, and rate confirmation
- Broker details and rate confirmations omitted from the driver portal
- Driver pay per load
- Weekly payroll summary
- Browser storage so demo data persists on the same device

## Production setup
To make logins, loads and documents permanent across devices:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create private storage buckets:
   - `load-photos`
   - `pod-documents`
   - `rate-confirmations`
4. Add these variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The SQL schema separates destinations from dispatch-only broker, reference, and
driver-pay data. Its policies unlock only the assigned load's destination after
a `load_photo` document exists; rate confirmations and dispatch details remain
staff-only. Every document carries the same `load_id`, so the POD and rate
confirmation stay joined for dispatch review.

## Driver load-photo rule
The delivery location remains locked until the driver uploads a loaded-freight photo. Uploading the photo automatically changes the status to Loaded and unlocks the delivery information.

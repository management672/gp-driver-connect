# G&P Driver Connect

A mobile-friendly logistics portal for G&P LOGISTICS LLC.

## What works immediately
- Driver and Dispatch demo portals
- Drivers see only their current active load
- Status updates
- POD file selection
- Dispatch load creation
- Rate confirmation file selection
- Driver pay per load
- Weekly payroll summary
- Browser storage so demo data persists on the same device

## Production setup
To make logins, loads and documents permanent across devices:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create private storage buckets:
   - `pod-documents`
   - `rate-confirmations`
4. Add these variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The app is structured so Supabase can be connected next without redesigning the interface.

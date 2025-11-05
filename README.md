# Project Setup Instructions

## Environment Variables

### Backend (.env)

Copy `backend/env.example` to `backend/.env` and fill in your Supabase credentials:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=4000
```

### Frontend (.env.local)

Copy `frontend/env.local.example` to `frontend/.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase Setup

1. **Enable Google OAuth Provider:**

   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Set Redirect URL to: `http://localhost:3000/auth/callback`
   - Configure Google OAuth credentials (Client ID and Secret)

2. **Database Schema:**
   The following tables should exist in your Supabase database:

   ```sql
   -- Property table
   CREATE TABLE property (
     property_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     timezone TEXT NOT NULL,
     active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- App user table
   CREATE TABLE app_user (
     user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     email TEXT UNIQUE NOT NULL,
     user_type TEXT NOT NULL,
     personal_multiplier DECIMAL DEFAULT 1.0,
     active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Stay record table
   CREATE TABLE stay_record (
     stay_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES app_user(user_id),
     property_id UUID REFERENCES property(property_id),
     start_date DATE NOT NULL,
     end_date DATE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Break record table
   CREATE TABLE break_record (
     break_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     stay_id UUID REFERENCES stay_record(stay_id),
     break_start DATE NOT NULL,
     break_end DATE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Tenant rent table
   CREATE TABLE tenant_rent (
     rent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES app_user(user_id),
     property_id UUID REFERENCES property(property_id),
     monthly_rent DECIMAL NOT NULL,
     start_date DATE NOT NULL,
     end_date DATE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Utility actual table
   CREATE TABLE utility_actual (
     actual_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     property_id UUID REFERENCES property(property_id),
     month_start DATE NOT NULL,
     utility TEXT NOT NULL,
     amount DECIMAL NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(property_id, month_start, utility)
   );

   -- Division rule default table
   CREATE TABLE division_rule_default (
     rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     property_id UUID REFERENCES property(property_id),
     utility TEXT NOT NULL,
     method TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(property_id, utility)
   );

   -- Bill run table
   CREATE TABLE bill_run (
     bill_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     property_id UUID REFERENCES property(property_id),
     month_start DATE NOT NULL,
     status TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Bill line table
   CREATE TABLE bill_line (
     bill_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     bill_run_id UUID REFERENCES bill_run(bill_run_id),
     user_id UUID REFERENCES app_user(user_id),
     utility TEXT NOT NULL,
     amount DECIMAL NOT NULL,
     detail_json JSONB,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Payment table
   CREATE TABLE payment (
     payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES app_user(user_id),
     property_id UUID REFERENCES property(property_id),
     paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
     amount DECIMAL NOT NULL,
     note TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Ledger table
   CREATE TABLE ledger (
     ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES app_user(user_id),
     property_id UUID REFERENCES property(property_id),
     source_type TEXT NOT NULL,
     source_id UUID NOT NULL,
     posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
     amount DECIMAL NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Create ENUMs
   CREATE TYPE utility_code AS ENUM ('rent', 'internet', 'garbage', 'electricity', 'water', 'gas');
   CREATE TYPE division_method AS ENUM ('fixed', 'equalshare', 'bydays');
   CREATE TYPE bill_status AS ENUM ('open', 'finalized', 'void');
   CREATE TYPE ledger_source AS ENUM ('bill', 'payment', 'adjustment');
   ```

3. **Enable RLS (Row Level Security):**

   ```sql
   -- Enable RLS on all tables
   ALTER TABLE property ENABLE ROW LEVEL SECURITY;
   ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
   ALTER TABLE stay_record ENABLE ROW LEVEL SECURITY;
   ALTER TABLE break_record ENABLE ROW LEVEL SECURITY;
   ALTER TABLE tenant_rent ENABLE ROW LEVEL SECURITY;
   ALTER TABLE utility_actual ENABLE ROW LEVEL SECURITY;
   ALTER TABLE division_rule_default ENABLE ROW LEVEL SECURITY;
   ALTER TABLE bill_run ENABLE ROW LEVEL SECURITY;
   ALTER TABLE bill_line ENABLE ROW LEVEL SECURITY;
   ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;

   -- Create policies (for development, allow all operations)
   -- In production, you should create more restrictive policies
   CREATE POLICY "Allow all operations for authenticated users" ON property FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON app_user FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON stay_record FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON break_record FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON tenant_rent FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON utility_actual FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON division_rule_default FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON bill_run FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON bill_line FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON payment FOR ALL USING (auth.role() = 'authenticated');
   CREATE POLICY "Allow all operations for authenticated users" ON ledger FOR ALL USING (auth.role() = 'authenticated');
   ```

## Running the Application

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

## Usage

1. Navigate to http://localhost:3000
2. You'll be redirected to the login page
3. Sign in with Google OAuth
4. You'll be redirected to the admin panel at /admin
5. Select a property and month
6. Configure utility settings and save

7. Run bill calculation

8. View all table data in the dump section

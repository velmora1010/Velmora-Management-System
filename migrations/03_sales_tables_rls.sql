-- 03_sales_tables_rls.sql
-- Enable RLS and add public access policies for sales_uploads, sales_raw_data, sales_orders, and sales_order_items

ALTER TABLE public.sales_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sales_uploads" ON public.sales_uploads;
CREATE POLICY "Allow all access to sales_uploads" ON public.sales_uploads FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.sales_raw_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sales_raw_data" ON public.sales_raw_data;
CREATE POLICY "Allow all access to sales_raw_data" ON public.sales_raw_data FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sales_orders" ON public.sales_orders;
CREATE POLICY "Allow all access to sales_orders" ON public.sales_orders FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sales_order_items" ON public.sales_order_items;
CREATE POLICY "Allow all access to sales_order_items" ON public.sales_order_items FOR ALL TO public USING (true) WITH CHECK (true);

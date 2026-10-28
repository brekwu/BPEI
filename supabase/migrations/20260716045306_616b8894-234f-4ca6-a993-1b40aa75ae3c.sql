-- Vague 1: Backend Achats avancé

-- 1. Extension enum statuts
ALTER TYPE public.purchase_order_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.purchase_order_status ADD VALUE IF NOT EXISTS 'late';
ALTER TYPE public.purchase_order_status ADD VALUE IF NOT EXISTS 'closed_variance';
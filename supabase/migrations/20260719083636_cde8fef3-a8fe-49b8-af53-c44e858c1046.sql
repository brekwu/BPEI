DO $$
DECLARE
  v_test_shop_ids uuid[];
  v_test_repair_ids uuid[];
  v_test_quote_ids uuid[];
  v_test_invoice_ids uuid[];
  v_test_agreement_ids uuid[];
  v_test_customer_ids uuid[];
  v_test_auth_ids uuid[] := ARRAY[
    '68711c2d-888c-4a75-bc28-c9c88d864589'::uuid,
    '5eb91684-9f05-4b19-8f02-391ce0054bee'::uuid,
    '8c9d62f2-089c-4ec9-b01f-bc2ec305f664'::uuid,
    '20641475-c6de-4d0a-b5ab-6e8d18c9fdc2'::uuid,
    '8564eb40-dc4b-438d-a21b-ab894cefaf00'::uuid,
    'b47b83dd-688a-45dc-b57d-ee4d173cd653'::uuid,
    'afef3639-885d-4d9d-9c8d-087171d114bb'::uuid,
    'e837c349-fa77-4eda-ba64-2d983d25f5cd'::uuid
  ];
BEGIN
  SET LOCAL session_replication_role = 'replica';

  SELECT array_agg(id) INTO v_test_shop_ids
  FROM public.shops WHERE name LIKE '[TEST%' OR name LIKE '[DEMO%';
  IF v_test_shop_ids IS NULL THEN RETURN; END IF;

  SELECT array_agg(id) INTO v_test_repair_ids FROM public.repairs WHERE shop_id = ANY(v_test_shop_ids);
  SELECT array_agg(id) INTO v_test_quote_ids FROM public.quotes WHERE shop_id = ANY(v_test_shop_ids);
  SELECT array_agg(id) INTO v_test_invoice_ids FROM public.invoices WHERE shop_id = ANY(v_test_shop_ids);
  SELECT array_agg(id) INTO v_test_agreement_ids FROM public.partner_agreements WHERE shop_id = ANY(v_test_shop_ids);
  SELECT array_agg(id) INTO v_test_customer_ids FROM public.customers WHERE shop_id = ANY(v_test_shop_ids);

  DELETE FROM public.repair_public_tokens WHERE repair_id = ANY(COALESCE(v_test_repair_ids, ARRAY[]::uuid[]));
  DELETE FROM public.repair_status_history WHERE repair_id = ANY(COALESCE(v_test_repair_ids, ARRAY[]::uuid[]));
  DELETE FROM public.repair_notes WHERE repair_id = ANY(COALESCE(v_test_repair_ids, ARRAY[]::uuid[]));
  DELETE FROM public.quote_public_tokens WHERE quote_id = ANY(COALESCE(v_test_quote_ids, ARRAY[]::uuid[]));
  DELETE FROM public.quote_lines WHERE quote_id = ANY(COALESCE(v_test_quote_ids, ARRAY[]::uuid[]));
  DELETE FROM public.invoice_lines WHERE invoice_id = ANY(COALESCE(v_test_invoice_ids, ARRAY[]::uuid[]));
  DELETE FROM public.credit_note_lines WHERE credit_note_id IN (SELECT id FROM public.credit_notes WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.electronic_invoice_events WHERE invoice_id = ANY(COALESCE(v_test_invoice_ids, ARRAY[]::uuid[]));
  DELETE FROM public.payments WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.credit_notes WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.invoices WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.quotes WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.sale_lines WHERE sale_id IN (SELECT id FROM public.sales WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.sales WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.repairs WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.appointment_blocked_slots WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.appointments WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.devices WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.customer_portal_links WHERE customer_id = ANY(COALESCE(v_test_customer_ids, ARRAY[]::uuid[]));
  DELETE FROM public.customer_portal_invitations WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.order_messages WHERE order_id IN (SELECT id FROM public.orders WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.orders WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.customers WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.stock_movements WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.stock_reservations WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.stock_inventory_lines WHERE inventory_id IN (SELECT id FROM public.stock_inventories WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.stock_inventories WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.stock_purchase_price_history WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.purchase_order_status_history WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.purchase_order_lines WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.purchase_orders WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.stock_item_suppliers WHERE stock_item_id IN (SELECT id FROM public.stock_items WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.stock_items WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.service_catalog WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.suppliers WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.message_templates WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.reviews WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.payment_links WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.cash_movements WHERE session_id IN (SELECT id FROM public.cash_sessions WHERE shop_id = ANY(v_test_shop_ids));
  DELETE FROM public.cash_sessions WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.terminal_readers WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.terminal_locations WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.technician_time_off WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.technician_availability WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.mission_orders WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.partner_missions WHERE shop_id = ANY(v_test_shop_ids) OR independent_shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.partner_opportunities WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.partner_agreement_events WHERE agreement_id = ANY(COALESCE(v_test_agreement_ids, ARRAY[]::uuid[]));
  DELETE FROM public.partner_agreement_versions WHERE agreement_id = ANY(COALESCE(v_test_agreement_ids, ARRAY[]::uuid[]));
  DELETE FROM public.partner_agreements WHERE id = ANY(COALESCE(v_test_agreement_ids, ARRAY[]::uuid[]));
  DELETE FROM public.shop_independent_framework_agreements WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_billing_settings WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_checkout_settings WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_business_hours WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_closures WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_enabled_modules WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_subscription_history WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_subscriptions WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_invitations WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_memberships WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shop_applications WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.document_number_counters WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.repair_number_counters WHERE shop_id = ANY(v_test_shop_ids);
  DELETE FROM public.shops WHERE id = ANY(v_test_shop_ids);

  DELETE FROM public.user_platform_roles WHERE user_id = ANY(v_test_auth_ids);
  DELETE FROM public.profiles WHERE id = ANY(v_test_auth_ids);
  DELETE FROM public.notifications WHERE user_id = ANY(v_test_auth_ids);
  DELETE FROM auth.identities WHERE user_id = ANY(v_test_auth_ids);
  DELETE FROM auth.sessions WHERE user_id = ANY(v_test_auth_ids);
  DELETE FROM auth.users
    WHERE id = ANY(v_test_auth_ids)
      AND (email LIKE '%@bpei.test' OR email = 'test-owner-b@bpei-test.local');
END $$;
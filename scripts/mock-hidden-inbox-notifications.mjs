/**
 * In mocked browser-only scenarios, BPEI Inbox is outside the subject under
 * test. Stub only its requests inside window.fetch, before the app initializes,
 * to avoid Safari cross-origin preflight races for the placeholder host.
 *
 * Unlike filtering page errors, all unrelated JavaScript failures still fail CI.
 * This never runs in the application and never reaches real Supabase.
 */
export async function stubMockInboxNotifications(context){
 await context.addInitScript(()=>{
  const original=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   const url=typeof input==="string"?input:input?.url??String(input);
   if(url.startsWith("https://placeholder.supabase.co/rest/v1/bpei_notifications")){
    const method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase();
    return Promise.resolve(new Response(method==="HEAD"?null:"[]",{
     status:200,headers:{"content-type":"application/json","content-range":"*/0"}
    }));
   }
   return original(input,init);
  };
 });
}

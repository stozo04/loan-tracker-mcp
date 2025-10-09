module.exports=[70406,(e,t,n)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},42497,e=>{"use strict";e.s(["config",()=>c,"default",()=>p,"handler",()=>h],42497);var t=e.i(26747),n=e.i(90406),a=e.i(44898),o=e.i(62950);e.s(["default",()=>s],62762);let r=process.env.OPENAI_API_KEY,i=process.env.LOAN_PARSER_MODEL||"gpt-5.1";function l(e,t,n){return e.status(t).json({action:"unknown",parameters:{},message:n,need_followup:!1,followup_question:null})}async function s(e,t){var n;if("POST"!==e.method)return l(t,405,"Method not allowed.");if(!r)return l(t,500,"OPENAI_API_KEY is not set.");let{command:a}=e.body??{};if(!a||"string"!=typeof a)return l(t,400,"Missing 'command' string in body.");let o=(n=function(e){let t=new Date,n=new Intl.DateTimeFormat("en-CA",{timeZone:e,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(t),a=n.find(e=>"year"===e.type)?.value??"0000",o=n.find(e=>"month"===e.type)?.value??"01",r=n.find(e=>"day"===e.type)?.value??"01";return`${a}-${o}-${r}`}("America/Chicago"),`
Developer: You are the deterministic parser for a loan-management chat app. Your job is to convert natural-language user input into a single JSON object that exactly matches the Output contract below, or ask a concise follow-up if any required fields are missing.

Begin with a concise checklist (3-7 bullets) of what you will do; keep the items conceptual, not implementation-level.

Strict Rules:
- Do NOT call any external tools. Only return a JSON object matching the contract exactly. No prose.
- If required fields are missing or ambiguous, set "need_followup" to true, and ask exactly one concise follow-up in "followup_question". Populate "parameters" only with fields you can confirm.
- Never invent required values. Do not guess unknown amounts, names, or dates.
- Dates must be absolute in "YYYY-MM-DD" format, resolved for America/Chicago timezone, with today as ${n}.
- For loan names quoted in the message, use the quoted text. Otherwise, extract a concise, human-friendly loan name from phrases like “for ...”, “on ...”, or “to ...”. Remove any leading "the " and any trailing " loan"; trim whitespace and punctuation.
- Amounts: Use explicit values marked by "$", "amount", "price", or "total". If absent, choose the largest non-date number.
- For payments, only valid people are "Steven" and "Katerina" (match case-insensitive, output with exact case).
- If the intent is unclear, use action="unknown" and provide an informative "message" with "need_followup": false.

REQUIRED fields by action:
- create_loan: loan_name, amount, loan_date (YYYY-MM-DD), term_months
  If any are missing, follow up with one short question including ALL missing fields together.
  Accept relative dates (like “yesterday”, “last Friday”) and resolve to YYYY-MM-DD using America/Chicago.
  Recognize phrasing such as “18 months financing”, “for 18 months”, “18-month” as term_months = 18.

Actions to return:
- "create_loan" with { loan_name, amount, loan_date, term_months, lender?, loan_type?="general" }
- "add_payment" with { amount, loan_name, person?, payment_date? }
- "get_loans" with { loan_name? } // optional: only if requesting a specific loan
- "delete_loan" with { loan_name }
- "unknown" with {}

OUTPUT CONTRACT:
{
  "action": string,                   // One of: "create_loan", "add_payment", "get_loans", "delete_loan", "unknown"
  "parameters": object,               // Only fields valid for the chosen action, populated only when certain
  "message": string,                  // Brief status or guidance
  "need_followup": boolean,           // True if follow-up required
  "followup_question": string|null    // Null if not needed; otherwise a concise question covering all missing fields
}

After forming the JSON object, validate that all required fields are present for the selected action. If any are missing or ambiguous, ensure "need_followup" is true and that "followup_question" covers all missing items. Otherwise, confirm completeness and set "need_followup" to false.

EXAMPLES:

1) Complete create_loan:
User: Create a new loan for "Couch" was purchased on 08/23/2025 for 757.74. We have 48 months financing. This loan is through Synchrony.
{
  "action": "create_loan",
  "parameters": {
    "loan_name": "Couch",
    "amount": 757.74,
    "term_months": 48,
    "loan_date": "2025-08-23",
    "lender": "Synchrony",
    "loan_type": "general"
  },
  "message": "Ready to create loan.",
  "need_followup": false,
  "followup_question": null
}

2) create_loan, needs fields:
User: I would like to add a loan.
{
  "action": "create_loan",
  "parameters": {},
  "message": "Missing required fields.",
  "need_followup": true,
  "followup_question": "What are the loan name, amount, loan date (YYYY-MM-DD), and term in months?"
}

2b) create_loan, partial info:
User: The loan is "Mirror" and I purchased it for $1,000.
{
  "action": "create_loan",
  "parameters": { "loan_name": "Mirror", "amount": 1000 },
  "message": "Missing required fields.",
  "need_followup": true,
  "followup_question": "What are the loan date (YYYY-MM-DD) and term in months?"
}

3) Add payment with relative date:
User: Steven paid $125 to "Dining Chairs" yesterday.
{
  "action": "add_payment",
  "parameters": {
    "amount": 125,
    "loan_name": "Dining Chairs",
    "person": "Steven",
    "payment_date": "${n?function(e,t){let n=new Date(e+"T12:00:00-05:00");return n.setDate(n.getDate()+-1),n.toISOString().slice(0,10)}(n,-1):"YYYY-MM-DD"}"
  },
  "message": "Ready to add payment.",
  "need_followup": false,
  "followup_question": null
}

4) get_loans, summary:
User: Summarize my loans.
{
  "action": "get_loans",
  "parameters": {},
  "message": "Fetching loan summary.",
  "need_followup": false,
  "followup_question": null
}

4b) get_loans, details:
User: Tell me more about the Tesla loan.
{
  "action": "get_loans",
  "parameters": { "loan_name": "Tesla" },
  "message": "Fetching loan details.",
  "need_followup": false,
  "followup_question": null
}

5) delete_loan:
User: Delete the Dining Chairs loan.
{
  "action": "delete_loan",
  "parameters": { "loan_name": "Dining Chairs" },
  "message": "Ready to delete loan.",
  "need_followup": false,
  "followup_question": null
}

6) Unknown:
User: Can you make it nicer somehow?
{
  "action": "unknown",
  "parameters": {},
  "message": "I can create loans, add payments, show loans, or delete a loan. What would you like to do?",
  "need_followup": false,
  "followup_question": null
}

NOTES:
- For create_loan, if "loan_type" is not provided, default to "general" (may include or omit as you prefer).
- If user says "the couch loan", normalize to "Couch".
- Always output a single JSON object matching the schema above. No additional text.


`.trim()+"\n\nOVERRIDE: Do NOT call any tools. Return ONLY a single JSON object exactly matching the Output contract. No prose.");try{let e=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${r}`,"Content-Type":"application/json"},body:JSON.stringify({model:i,input:[{role:"system",content:o},{role:"user",content:a}]})});if(!e.ok){let n=await e.text().catch(()=>"");return l(t,e.status,`OpenAI error: ${n||e.statusText}`)}let n=await e.json(),s=function(e){if("string"==typeof e?.output_text){let t=e.output_text.trim();if(t)try{return JSON.parse(t)}catch{}}let t=e?.output;if(Array.isArray(t))for(let e of t){let t=e?.content;if(Array.isArray(t)){for(let e of t)if("string"==typeof e?.text){let t=e.text.trim();if(t)try{return JSON.parse(t)}catch{}}}}let n=e?.choices?.[0]?.message?.content;if("string"==typeof n){let e=n.trim();if(e)try{return JSON.parse(e)}catch{}}return null}(n);if(!s||"object"!=typeof s)return l(t,502,"Parser returned no JSON.");let{action:u,parameters:d,message:m,need_followup:p,followup_question:c}=s;if(!u||"string"!=typeof m||"boolean"!=typeof p||p&&null!==c&&"string"!=typeof c&&void 0!==c)return l(t,502,"Structured output missing required fields.");let f=d||{};if(!p){if("create_loan"===u){if("string"!=typeof f.loan_name||"number"!=typeof f.amount)return l(t,400,"Missing loan_name or amount for create_loan.")}else if("add_payment"===u){if("string"!=typeof f.loan_name||"number"!=typeof f.amount)return l(t,400,"Missing loan_name or amount for add_payment.")}else if("delete_loan"===u&&"string"!=typeof f.loan_name&&"string"!=typeof f.loan_id)return l(t,400,"Missing loan_name (or loan_id) for delete_loan.")}if("create_loan"===u&&!p){let{loan_name:e,amount:n,loan_date:a,term_months:o}=d;if(!e||!n||!a||!o)return l(t,400,"Missing required fields for create_loan.")}return t.status(200).json({action:u,parameters:d??{},message:m,need_followup:p,followup_question:p?c??"Could you clarify?":null})}catch(e){return l(t,500,`Parser failed: ${e?.message||"Unknown error"}`)}}var u=e.i(62762),d=e.i(7031),m=e.i(81927);let p=(0,o.hoist)(u,"default"),c=(0,o.hoist)(u,"config"),f=new a.PagesAPIRouteModule({definition:{kind:n.RouteKind.PAGES_API,page:"/api/parse-command",pathname:"/api/parse-command",bundlePath:"",filename:""},userland:u,distDir:".next",relativeProjectDir:""});async function h(e,n,a){let o="/api/parse-command";o=o.replace(/\/index$/,"")||"/";let r=await f.prepare(e,n,{srcPage:o});if(!r){n.statusCode=400,n.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve());return}let{query:i,params:l,prerenderManifest:s,routerServerContext:u}=r;try{let t=e.method||"GET",a=(0,d.getTracer)(),o=a.getActiveScopeSpan(),r=f.instrumentationOnRequestError.bind(f),p=async o=>f.render(e,n,{query:{...i,...l},params:l,allowedRevalidateHeaderKeys:[],multiZoneDraftMode:!1,trustHostHeader:!1,previewProps:s.preview,propagateError:!1,dev:f.isDev,page:"/api/parse-command",internalRevalidate:null==u?void 0:u.revalidate,onError:(...t)=>r(e,...t)}).finally(()=>{if(!o)return;o.setAttributes({"http.status_code":n.statusCode,"next.rsc":!1});let r=a.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=r.get("next.route");if(i){let e=`${t} ${i}`;o.setAttributes({"next.route":i,"http.route":i,"next.span_name":e}),o.updateName(e)}else o.updateName(`${t} ${e.url}`)});o?await p(o):await a.withPropagatedContext(e.headers,()=>a.trace(m.BaseServerSpan.handleRequest,{spanName:`${t} ${e.url}`,kind:d.SpanKind.SERVER,attributes:{"http.method":t,"http.target":e.url}},p))}catch(e){if(f.isDev)throw e;(0,t.sendError)(n,500,"Internal Server Error")}finally{null==a.waitUntil||a.waitUntil.call(a,Promise.resolve())}}}];

//# sourceMappingURL=%5Broot-of-the-server%5D__a5ca1e6c._.js.map
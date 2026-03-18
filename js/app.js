/* =============================================
   MedLab LIS v5 — Application Logic
   Data stored in Firebase Realtime Database (multi-user, cloud sync)
   ============================================= */

// ═══════════════════════════════════════
// FIREBASE CONFIG  ← FILL IN YOUR VALUES
// ═══════════════════════════════════════
const FB_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

firebase.initializeApp(FB_CONFIG);
const DB = firebase.database();

// ═══════════════════════════════════════
// CONSTANTS & STATE
// ═══════════════════════════════════════
const ADMIN={u:'Admin',p:'Admin12345'};
const SK={users:'lisV5_users',patients:'lisV5_patients',tests:'lisV5_tests',orders:'lisV5_orders',results:'lisV5_results',billing:'lisV5_billing',shifts:'lisV5_shifts',curShift:'lisV5_curShift'};
let CU=null,loginRole='doctor';

// ═══════════════════════════════════════
// IN-MEMORY CACHE  (populated from Firebase on startup)
// ═══════════════════════════════════════
let _c={users:[],patients:[],tests:[],orders:[],results:[],billing:[],shifts:[],curShift:null};
let _appReady=false, _writing=false;

function _raw2arr(raw){
  if(!raw)return[];
  if(Array.isArray(raw))return raw;
  if(typeof raw==='object')return Object.values(raw);
  return[];
}

// ═══════════════════════════════════════
// STORAGE  (synchronous reads from cache, async writes to Firebase)
// ═══════════════════════════════════════
function ld(k){return Array.isArray(_c[k])?_c[k]:[];}
function ldOne(k){return _c[k]||null;}

function sv(k,d){
  _c[k]=d;
  _writing=true;
  DB.ref(SK[k]).set(d).then(()=>{_writing=false;}).catch(e=>{_writing=false;console.error('FB write error:',e);toast('Sync error: '+e.message,'error');});
  syncMsg();
}
function svOne(k,d){
  _c[k]=d;
  _writing=true;
  DB.ref(SK[k]).set(d).then(()=>{_writing=false;}).catch(e=>{_writing=false;console.error('FB write error:',e);toast('Sync error: '+e.message,'error');});
  syncMsg();
}

function syncMsg(){
  const e=document.getElementById('syncInfo');
  if(e){const t=new Date();e.innerHTML='☁ Synced '+t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});e.style.color='var(--green2)';}
}

// ═══════════════════════════════════════
// REAL-TIME LISTENER  (keep cache fresh; re-render active view)
// ═══════════════════════════════════════
function _setupLive(){
  DB.ref('/').on('value',snap=>{
    if(_writing)return; // ignore echo from our own write
    const data=snap.val()||{};
    Object.keys(SK).forEach(k=>{
      const raw=data[SK[k]];
      _c[k]=(k==='curShift')?( raw||null):_raw2arr(raw);
    });
    if(_appReady&&CU){
      const av=document.querySelector('.view.active');
      if(av){
        const pg=av.id.replace('-view','');
        const fns={admDash:renderAdmDash,users:renderUsers,docDash:renderDocDash,labDash:renderLabDash,patients:renderPatients,orders:renderOrders,results:renderResults,billing:renderBilling};
        if(fns[pg])fns[pg]();
      }
    }
  });
}

// ═══════════════════════════════════════
// LOADER HELPERS
// ═══════════════════════════════════════
function _showLoad(msg){document.getElementById('appLoader').classList.remove('hn');document.getElementById('appLoaderMsg').textContent=msg||'Loading…';}
function _hideLoad(){document.getElementById('appLoader').classList.add('hn');}

// ═══════════════════════════════════════
// FIREBASE STARTUP  (replaces direct initData/checkSession call at bottom)
// ═══════════════════════════════════════
async function fbInit(){
  _showLoad('Connecting to MedLab database…');
  try{
    const snap=await DB.ref('/').once('value');
    const data=snap.val()||{};
    Object.keys(SK).forEach(k=>{
      const raw=data[SK[k]];
      _c[k]=(k==='curShift')?(raw||null):_raw2arr(raw);
    });
    _setupLive();
    _appReady=true;
    _hideLoad();
    initData();
    checkSession();
    setRole('doctor');
  }catch(err){
    _hideLoad();
    document.getElementById('appLoader').classList.remove('hn');
    document.getElementById('appLoaderMsg').innerHTML=
      '<span style="color:#e53935">⚠ Database connection failed.<br>'+err.message+'<br><br>Check FB_CONFIG in app.js and Firebase rules.</span>';
  }
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function tod(){return new Date().toISOString().slice(0,10);}
function nowT(){return new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function fmtD(d){if(!d||d==='—')return'—';try{return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function gV(id){const e=document.getElementById(id);return e?e.value:'';}
function sV(id,v){const e=document.getElementById(id);if(e)e.value=(v==null?'':v);}
function genID(pre,arr){const ns=arr.map(x=>parseInt((x.id||'').replace(/\D/g,''))||0);return pre+String(Math.max(0,...ns)+1).padStart(4,'0');}
function toast(msg,t='success'){
  const el=document.getElementById('toast');
  el.textContent=msg;el.style.background=t==='error'?'var(--red2)':t==='warn'?'#795548':'var(--green2)';
  el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3200);
}
function openM(id){document.getElementById(id).classList.add('open');}
function closeM(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.mOver').forEach(m=>{m.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});});
function conf2(title,msg,cb){
  document.getElementById('confTitle').textContent=title;
  document.getElementById('confMsg').textContent=msg;
  const b=document.getElementById('confOK');b.onclick=()=>{closeM('confModal');cb();};
  openM('confModal');
}
function sBadge(s){const m={Completed:'bG','In Progress':'bGd',Pending:'bGr',Cancelled:'bR'};return`<span class="badge ${m[s]||'bGr'}">${esc(s)}</span>`;}
function pBadge(p){const m={Routine:'bB',Urgent:'bO',STAT:'bR'};return`<span class="badge ${m[p]||'bB'}">${p==='STAT'?'⚡ ':p==='Urgent'?'🔴 ':''}${esc(p)}</span>`;}
function rBadge(r){if(r==='doctor')return`<span class="rBadge rbD">👨‍⚕️ Doctor</span>`;if(r==='lab')return`<span class="rBadge rbL">🔬 Lab Tech</span>`;return`<span class="rBadge rbA">🛡️ Admin</span>`;}
function flagEl(f){if(!f||f==='—')return`<span class="flag fE">—</span>`;return`<span class="flag f${f}">${f}</span>`;}
function getTests(o){if(Array.isArray(o.tests))return o.tests;const t=[];['test1','test2','test3','test4','test5','test6'].forEach(k=>{if(o[k])t.push(o[k]);});return t;}
function show(id,v){const e=document.getElementById(id);if(!e)return;v?e.classList.remove('hn'):e.classList.add('hn');}

// ═══════════════════════════════════════
// INIT DATA
// ═══════════════════════════════════════
function initData(){
  if(!ld('users').length) sv('users',[
    {id:'U001',username:'dr.khatib', password:'doctor123',role:'doctor',name:'Dr. Mohammed Al-Khatib',specialty:'Internal Medicine',dept:'Outpatient',phone:'0591111111',email:'dr.khatib@lab.ps',lic:'MD-001',labDept:'',notes:'',status:'Active',created:tod()},
    {id:'U002',username:'dr.najjar', password:'doctor123',role:'doctor',name:'Dr. Samar Al-Najjar',  specialty:'Cardiology',       dept:'Cardiology', phone:'0592222222',email:'dr.najjar@lab.ps', lic:'MD-002',labDept:'',notes:'',status:'Active',created:tod()},
    {id:'U003',username:'dr.obaidat',password:'doctor123',role:'doctor',name:'Dr. Khaled Obaidat',  specialty:'Endocrinology',    dept:'Outpatient', phone:'0593333333',email:'dr.obaidat@lab.ps',lic:'MD-003',labDept:'',notes:'',status:'Active',created:tod()},
    {id:'U004',username:'labtech1',  password:'lab123',   role:'lab',   name:'Ahmad Al-Mukhtar',    specialty:'',                 dept:'',           phone:'0594444444',email:'labtech1@lab.ps',  lic:'',labDept:'Hematology',notes:'',status:'Active',created:tod()},
    {id:'U005',username:'labtech2',  password:'lab123',   role:'lab',   name:'Hana Abu-Saleh',      specialty:'',                 dept:'',           phone:'0595555555',email:'labtech2@lab.ps',  lic:'',labDept:'Chemistry', notes:'',status:'Active',created:tod()},
  ]);
  if(!ld('tests').length) sv('tests',[
    {id:'T001',name:'CBC — Complete Blood Count',    status:'Active',dept:'Hematology',  sample:'Blood (EDTA)',  price:35,tat:'4',unit:'—',     norm:'See report',normM:'',normF:'',method:'Automated Analyzer',notes:'No fasting required',
     params:[{name:'WBC',unit:'x10³/µL',normM:'4–11',normF:'4–11'},{name:'RBC',unit:'x10⁶/µL',normM:'4.5–5.5',normF:'4.0–5.0'},{name:'HGB',unit:'g/dL',normM:'13.5–17.5',normF:'12–16'},{name:'HCT',unit:'%',normM:'41–53',normF:'36–46'},{name:'PLT',unit:'x10³/µL',normM:'150–400',normF:'150–400'},{name:'MCV',unit:'fL',normM:'80–100',normF:'80–100'},{name:'MCH',unit:'pg',normM:'27–33',normF:'27–33'},{name:'MCHC',unit:'g/dL',normM:'32–36',normF:'32–36'}]},
    {id:'T002',name:'ESR',                           status:'Active',dept:'Hematology',  sample:'Blood (EDTA)',  price:15,tat:'2',unit:'mm/hr',  norm:'M<15 F<20', normM:'< 15',normF:'< 20',method:'Westergren',notes:'',params:[]},
    {id:'T003',name:'PT / INR',                      status:'Active',dept:'Coagulation', sample:'Blood (Citrate)',price:25,tat:'3',unit:'sec',    norm:'11–13',     normM:'11–13',normF:'11–13',method:'Coagulometer',notes:'',
     params:[{name:'PT',unit:'sec',normM:'11–13',normF:'11–13'},{name:'INR',unit:'ratio',normM:'0.8–1.2',normF:'0.8–1.2'},{name:'APTT',unit:'sec',normM:'25–35',normF:'25–35'}]},
    {id:'T004',name:'Blood Glucose — Fasting',       status:'Active',dept:'Chemistry',   sample:'Blood (Serum)', price:10,tat:'1',unit:'mg/dL',  norm:'70–110',    normM:'70–110',normF:'70–110',method:'Colorimetric',notes:'8 hrs fasting',params:[]},
    {id:'T005',name:'HbA1c',                         status:'Active',dept:'Chemistry',   sample:'Blood (EDTA)',  price:40,tat:'4',unit:'%',      norm:'< 5.7%',    normM:'< 5.7',normF:'< 5.7',method:'HPLC',notes:'No fasting required',params:[]},
    {id:'T006',name:'CMP — Complete Metabolic Panel',status:'Active',dept:'Chemistry',   sample:'Blood (Serum)', price:65,tat:'6',unit:'—',       norm:'See report',normM:'',normF:'',method:'Analyzer',notes:'8 hrs fasting',
     params:[{name:'Glucose',unit:'mg/dL',normM:'70–110',normF:'70–110'},{name:'BUN',unit:'mg/dL',normM:'7–20',normF:'7–20'},{name:'Creatinine',unit:'mg/dL',normM:'0.7–1.3',normF:'0.5–1.1'},{name:'Sodium',unit:'mEq/L',normM:'136–145',normF:'136–145'},{name:'Potassium',unit:'mEq/L',normM:'3.5–5.0',normF:'3.5–5.0'},{name:'Total Protein',unit:'g/dL',normM:'6.4–8.3',normF:'6.4–8.3'},{name:'Albumin',unit:'g/dL',normM:'3.5–5.0',normF:'3.5–5.0'}]},
    {id:'T007',name:'Lipid Panel',                   status:'Active',dept:'Chemistry',   sample:'Blood (Serum)', price:50,tat:'4',unit:'mg/dL',  norm:'See report',normM:'',normF:'',method:'Analyzer',notes:'12 hrs fasting',
     params:[{name:'Total Cholesterol',unit:'mg/dL',normM:'< 200',normF:'< 200'},{name:'HDL',unit:'mg/dL',normM:'> 40',normF:'> 50'},{name:'LDL',unit:'mg/dL',normM:'< 100',normF:'< 100'},{name:'Triglycerides',unit:'mg/dL',normM:'< 150',normF:'< 150'}]},
    {id:'T008',name:'TSH — Thyroid Stimulating Hormone',status:'Active',dept:'Hormones',sample:'Blood (Serum)',price:45,tat:'6',unit:'mIU/L',norm:'0.4–4.0',normM:'0.4–4.0',normF:'0.4–4.0',method:'ELISA',notes:'',params:[]},
    {id:'T009',name:'Free T3 / Free T4',             status:'Active',dept:'Hormones',   sample:'Blood (Serum)', price:40,tat:'6',unit:'—',       norm:'See report',normM:'',normF:'',method:'ELISA',notes:'',
     params:[{name:'Free T3',unit:'pg/mL',normM:'2.3–4.2',normF:'2.3–4.2'},{name:'Free T4',unit:'ng/dL',normM:'0.8–1.8',normF:'0.8–1.8'}]},
    {id:'T010',name:'Urine Analysis',                status:'Active',dept:'Urinalysis', sample:'Urine',         price:15,tat:'1',unit:'—',       norm:'See report',normM:'',normF:'',method:'Dipstick+Microscopy',notes:'Midstream sample',
     params:[{name:'pH',unit:'',normM:'5–8',normF:'5–8'},{name:'Specific Gravity',unit:'',normM:'1.010–1.030',normF:'1.010–1.030'},{name:'Protein',unit:'',normM:'Negative',normF:'Negative'},{name:'Glucose',unit:'',normM:'Negative',normF:'Negative'},{name:'WBC',unit:'/HPF',normM:'0–5',normF:'0–5'},{name:'RBC',unit:'/HPF',normM:'0–2',normF:'0–2'}]},
    {id:'T011',name:'Urine Culture & Sensitivity',   status:'Active',dept:'Microbiology',sample:'Urine',        price:60,tat:'48',unit:'—',      norm:'No growth',  normM:'No growth',normF:'No growth',method:'Culture',notes:'',params:[]},
    {id:'T012',name:'CRP — C-Reactive Protein',      status:'Active',dept:'Immunology', sample:'Blood (Serum)', price:30,tat:'3',unit:'mg/L',    norm:'< 5',        normM:'< 5',normF:'< 5',method:'Turbidimetry',notes:'',params:[]},
    {id:'T013',name:'Vitamin D (25-OH)',              status:'Active',dept:'Chemistry',  sample:'Blood (Serum)', price:60,tat:'6',unit:'ng/mL',   norm:'30–100',     normM:'30–100',normF:'30–100',method:'ELISA',notes:'',params:[]},
    {id:'T014',name:'Vitamin B12',                   status:'Active',dept:'Chemistry',  sample:'Blood (Serum)', price:55,tat:'6',unit:'pg/mL',   norm:'200–900',    normM:'200–900',normF:'200–900',method:'ELISA',notes:'',params:[]},
    {id:'T015',name:'Ferritin',                      status:'Active',dept:'Chemistry',  sample:'Blood (Serum)', price:45,tat:'6',unit:'ng/mL',   norm:'See report', normM:'12–300',normF:'12–150',method:'ELISA',notes:'',params:[]},
    {id:'T016',name:'HBsAg — Hepatitis B',           status:'Active',dept:'Serology',   sample:'Blood (Serum)', price:45,tat:'4',unit:'—',       norm:'Non-reactive',normM:'Non-reactive',normF:'Non-reactive',method:'ELISA',notes:'',params:[]},
    {id:'T017',name:'HCV Antibody',                  status:'Active',dept:'Serology',   sample:'Blood (Serum)', price:45,tat:'4',unit:'—',       norm:'Non-reactive',normM:'Non-reactive',normF:'Non-reactive',method:'ELISA',notes:'',params:[]},
    {id:'T018',name:'LFT — Liver Function Tests',    status:'Active',dept:'Chemistry',  sample:'Blood (Serum)', price:55,tat:'4',unit:'—',       norm:'See report', normM:'',normF:'',method:'Analyzer',notes:'',
     params:[{name:'ALT (SGPT)',unit:'U/L',normM:'7–56',normF:'7–45'},{name:'AST (SGOT)',unit:'U/L',normM:'10–40',normF:'10–35'},{name:'ALP',unit:'U/L',normM:'44–147',normF:'44–147'},{name:'GGT',unit:'U/L',normM:'8–61',normF:'5–36'},{name:'Total Bilirubin',unit:'mg/dL',normM:'0.2–1.2',normF:'0.2–1.2'}]},
    {id:'T019',name:'KFT — Kidney Function Tests',   status:'Active',dept:'Chemistry',  sample:'Blood (Serum)', price:40,tat:'3',unit:'—',       norm:'See report', normM:'',normF:'',method:'Analyzer',notes:'',
     params:[{name:'Creatinine',unit:'mg/dL',normM:'0.7–1.3',normF:'0.5–1.1'},{name:'BUN',unit:'mg/dL',normM:'7–20',normF:'7–20'},{name:'Uric Acid',unit:'mg/dL',normM:'3.5–7.2',normF:'2.6–6.0'}]},
    {id:'T020',name:'PSA — Prostate Specific Antigen',status:'Active',dept:'Hormones', sample:'Blood (Serum)', price:50,tat:'6',unit:'ng/mL',   norm:'< 4.0',      normM:'< 4.0',normF:'N/A',method:'ELISA',notes:'Males only',params:[]},
    {id:'T021',name:'CA-125',                         status:'Active',dept:'Hormones',  sample:'Blood (Serum)', price:70,tat:'6',unit:'U/mL',    norm:'< 35',       normM:'< 35',normF:'< 35',method:'ELISA',notes:'',params:[]},
    {id:'T022',name:'HIV 1 & 2 Antibodies',           status:'Active',dept:'Serology',  sample:'Blood (Serum)', price:60,tat:'4',unit:'—',       norm:'Non-reactive',normM:'Non-reactive',normF:'Non-reactive',method:'ELISA',notes:'',params:[]},
    {id:'T023',name:'H. Pylori Antigen (Stool)',      status:'Active',dept:'Microbiology',sample:'Stool',       price:55,tat:'4',unit:'—',       norm:'Negative',   normM:'Negative',normF:'Negative',method:'Immunochromatography',notes:'',params:[]},
    {id:'T024',name:'Widal Test',                     status:'Active',dept:'Serology',  sample:'Blood (Serum)', price:25,tat:'3',unit:'titer',   norm:'< 1:80',     normM:'< 1:80',normF:'< 1:80',method:'Tube Agglutination',notes:'',params:[]},
    {id:'T025',name:'Blood Culture',                  status:'Active',dept:'Microbiology',sample:'Blood (EDTA)',price:80,tat:'72',unit:'—',      norm:'No growth',  normM:'No growth',normF:'No growth',method:'Automated Culture',notes:'',params:[]},
  ]);
  if(!ld('patients').length) sv('patients',[
    {id:'P0001',name:'Mohammed Ali Hassan',  dob:'1978-01-01',age:46,gender:'Male',  blood:'A+',phone:'0591234567',email:'',address:'Jenin - Center', ins:'',notes:'',date:tod(),ownerId:'U001',ownerName:'Dr. Mohammed Al-Khatib',ownerRole:'doctor',type:'regular'},
    {id:'P0002',name:'Sara Ahmed Mahmoud',   dob:'1985-03-15',age:39,gender:'Female',blood:'B+',phone:'0592345678',email:'',address:'Nablus',          ins:'',notes:'',date:tod(),ownerId:'U002',ownerName:'Dr. Samar Al-Najjar',  ownerRole:'doctor',type:'regular'},
    {id:'P0003',name:'Yousef Khaled Zeidan', dob:'1990-07-22',age:34,gender:'Male',  blood:'O+',phone:'0593456789',email:'',address:'Tulkarm',         ins:'',notes:'',date:tod(),ownerId:'U001',ownerName:'Dr. Mohammed Al-Khatib',ownerRole:'doctor',type:'regular'},
    {id:'P0004',name:'Reem Omar Al-Saleh',   dob:'1968-11-10',age:55,gender:'Female',blood:'AB+',phone:'0594567890',email:'',address:'Jenin - Zuhour',ins:'',notes:'',date:tod(),ownerId:'U003',ownerName:'Dr. Khaled Obaidat',  ownerRole:'doctor',type:'regular'},
    {id:'P0005',name:'Ahmed Sami Al-Helo',   dob:'1995-06-05',age:29,gender:'Male',  blood:'O-',phone:'0595678901',email:'',address:'Jenin - Camp',   ins:'',notes:'',date:tod(),ownerId:'U001',ownerName:'Dr. Mohammed Al-Khatib',ownerRole:'doctor',type:'regular'},
    {id:'P0006',name:'Laila Saeed Ibrahim',  dob:'2000-09-18',age:24,gender:'Female',blood:'A-',phone:'0596789012',email:'',address:'Ramallah',        ins:'',notes:'',date:tod(),ownerId:'U004',ownerName:'Ahmad Al-Mukhtar',    ownerRole:'lab',   type:'outpatient'},
  ]);
  if(!ld('orders').length) sv('orders',[
    {id:'ORD0001',date:tod(),patient:'Mohammed Ali Hassan', patientId:'P0001',doctorId:'U001',doctor:'Dr. Mohammed Al-Khatib',tests:['CBC — Complete Blood Count','Blood Glucose — Fasting'],status:'Completed',  priority:'Routine',notes:'',shiftId:'SH0001'},
    {id:'ORD0002',date:tod(),patient:'Sara Ahmed Mahmoud',  patientId:'P0002',doctorId:'U002',doctor:'Dr. Samar Al-Najjar',  tests:['Lipid Panel','TSH — Thyroid Stimulating Hormone'],status:'Completed',  priority:'Routine',notes:'',shiftId:'SH0001'},
    {id:'ORD0003',date:tod(),patient:'Yousef Khaled Zeidan',patientId:'P0003',doctorId:'U001',doctor:'Dr. Mohammed Al-Khatib',tests:['HbA1c','CMP — Complete Metabolic Panel'],           status:'In Progress',priority:'Urgent', notes:'Diabetic follow-up',shiftId:'SH0001'},
    {id:'ORD0004',date:tod(),patient:'Reem Omar Al-Saleh',  patientId:'P0004',doctorId:'U003',doctor:'Dr. Khaled Obaidat',  tests:['CBC — Complete Blood Count','CA-125'],                status:'Pending',    priority:'Routine',notes:'',shiftId:'SH0001'},
    {id:'ORD0005',date:tod(),patient:'Ahmed Sami Al-Helo',  patientId:'P0005',doctorId:'U001',doctor:'Dr. Mohammed Al-Khatib',tests:['Urine Analysis','CRP — C-Reactive Protein'],       status:'Completed',  priority:'Routine',notes:'',shiftId:'SH0001'},
    {id:'ORD0006',date:tod(),patient:'Laila Saeed Ibrahim', patientId:'P0006',doctorId:'U004',doctor:'Ahmad Al-Mukhtar (Lab)',tests:['Blood Glucose — Fasting','ESR'],                   status:'Pending',    priority:'STAT',   notes:'Walk-in outpatient',shiftId:'SH0001'},
  ]);
  if(!ld('results').length) sv('results',[
    {id:'R0001',date:tod(),orderId:'ORD0001',patient:'Mohammed Ali Hassan', patientId:'P0001',testId:'T001',testName:'CBC — Complete Blood Count',paramName:'WBC', value:'7.8', unit:'x10³/µL',norm:'4–11',     flag:'N',tech:'labtech1',comment:''},
    {id:'R0002',date:tod(),orderId:'ORD0001',patient:'Mohammed Ali Hassan', patientId:'P0001',testId:'T001',testName:'CBC — Complete Blood Count',paramName:'HGB', value:'14.2',unit:'g/dL',   norm:'13.5–17.5',flag:'N',tech:'labtech1',comment:''},
    {id:'R0003',date:tod(),orderId:'ORD0001',patient:'Mohammed Ali Hassan', patientId:'P0001',testId:'T001',testName:'CBC — Complete Blood Count',paramName:'PLT', value:'320', unit:'x10³/µL',norm:'150–400',  flag:'N',tech:'labtech1',comment:''},
    {id:'R0004',date:tod(),orderId:'ORD0001',patient:'Mohammed Ali Hassan', patientId:'P0001',testId:'T004',testName:'Blood Glucose — Fasting',    paramName:'',   value:'135', unit:'mg/dL',  norm:'70–110',   flag:'H',tech:'labtech1',comment:'Elevated fasting glucose'},
    {id:'R0005',date:tod(),orderId:'ORD0002',patient:'Sara Ahmed Mahmoud',  patientId:'P0002',testId:'T007',testName:'Lipid Panel',                 paramName:'Total Cholesterol',value:'215',unit:'mg/dL',norm:'< 200',flag:'H',tech:'labtech2',comment:''},
    {id:'R0006',date:tod(),orderId:'ORD0002',patient:'Sara Ahmed Mahmoud',  patientId:'P0002',testId:'T007',testName:'Lipid Panel',                 paramName:'HDL',              value:'52', unit:'mg/dL',norm:'> 50', flag:'N',tech:'labtech2',comment:''},
    {id:'R0007',date:tod(),orderId:'ORD0002',patient:'Sara Ahmed Mahmoud',  patientId:'P0002',testId:'T007',testName:'Lipid Panel',                 paramName:'LDL',              value:'128',unit:'mg/dL',norm:'< 100',flag:'H',tech:'labtech2',comment:'Borderline high'},
    {id:'R0008',date:tod(),orderId:'ORD0002',patient:'Sara Ahmed Mahmoud',  patientId:'P0002',testId:'T008',testName:'TSH — Thyroid Stimulating Hormone',paramName:'',           value:'3.1',unit:'mIU/L',norm:'0.4–4.0',flag:'N',tech:'labtech2',comment:''},
    {id:'R0009',date:tod(),orderId:'ORD0005',patient:'Ahmed Sami Al-Helo',  patientId:'P0005',testId:'T012',testName:'CRP — C-Reactive Protein',    paramName:'',   value:'42',  unit:'mg/L',  norm:'< 5',      flag:'H',tech:'labtech1',comment:'Significant inflammation'},
  ]);
  if(!ld('billing').length) sv('billing',[
    {id:'INV0001',date:tod(),patient:'Mohammed Ali Hassan', patientId:'P0001',doctorId:'U001',doctor:'Dr. Mohammed Al-Khatib',total:45,  paid:45, notes:''},
    {id:'INV0002',date:tod(),patient:'Sara Ahmed Mahmoud',  patientId:'P0002',doctorId:'U002',doctor:'Dr. Samar Al-Najjar',  total:95,  paid:50, notes:'Remaining next visit'},
    {id:'INV0003',date:tod(),patient:'Yousef Khaled Zeidan',patientId:'P0003',doctorId:'U001',doctor:'Dr. Mohammed Al-Khatib',total:105, paid:105,notes:''},
    {id:'INV0004',date:tod(),patient:'Reem Omar Al-Saleh',  patientId:'P0004',doctorId:'U003',doctor:'Dr. Khaled Obaidat',  total:105, paid:0,  notes:'Insurance pending'},
    {id:'INV0005',date:tod(),patient:'Ahmed Sami Al-Helo',  patientId:'P0005',doctorId:'U001',doctor:'Dr. Mohammed Al-Khatib',total:45,  paid:45, notes:''},
  ]);
  if(!ldOne('curShift')) svOne('curShift',{id:'SH0001',labUser:'labtech1',labName:'Ahmad Al-Mukhtar',startDate:tod(),startTime:'08:00',ordersProcessed:4,resultsEntered:9,patientsAdded:1});
}

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
function setRole(r){
  loginRole=r;
  document.getElementById('ltA').classList.toggle('active',r==='admin');
  document.getElementById('ltD').classList.toggle('active',r==='doctor');
  document.getElementById('ltL').classList.toggle('active',r==='lab');
  sV('lUser','');sV('lPass','');
  document.getElementById('lErr').classList.remove('show');
  const btn=document.getElementById('lBtn');
  btn.className='lBtn '+(r==='admin'?'bA':r==='doctor'?'bD':'bL');
  const hintTitles={admin:'🔑 Admin Credentials',doctor:'🔑 Doctor Login',lab:'🔑 Lab Technician Login'};
  document.getElementById('lHintTitle').textContent=hintTitles[r];
  const hints={admin:'Admin: Username <b>Admin</b> / Password <b>Admin12345</b>',doctor:'Doctor accounts are created by the Admin panel. Use credentials provided by your admin.',lab:'Lab technician accounts are created by the Admin panel. Use credentials provided by your admin.'};
  document.getElementById('lHintBody').innerHTML=hints[r];
}

function doLogin(){
  const u=gV('lUser').trim();const p=gV('lPass');
  const err=document.getElementById('lErr');err.classList.remove('show');
  if(loginRole==='admin'){
    if(u===ADMIN.u&&p===ADMIN.p){CU={id:'admin',username:'Admin',role:'admin',name:'System Administrator',avatar:'🛡️'};finishLogin();return;}
  }else{
    const found=ld('users').find(x=>x.username===u&&x.password===p&&x.role===loginRole&&x.status==='Active');
    if(found){CU={...found,avatar:found.role==='doctor'?'👨‍⚕️':'🔬'};finishLogin();return;}
  }
  err.classList.add('show');sV('lPass','');
}

function finishLogin(){
  sessionStorage.setItem('lisV5_user',JSON.stringify(CU));
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('uName').textContent=CU.username;
  document.getElementById('uRole').textContent=CU.role.toUpperCase();
  document.getElementById('uAv').textContent=CU.avatar;
  setDates();setupUI();
}

function doLogout(){
  sessionStorage.removeItem('lisV5_user');CU=null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  sV('lUser','');sV('lPass','');setRole('doctor');
}

function checkSession(){const s=sessionStorage.getItem('lisV5_user');if(s){try{CU=JSON.parse(s);finishLogin();}catch{}}}

function setupUI(){
  const r=CU.role;
  const vb=document.getElementById('vBadge');vb.textContent=`v5.0 · ${r.toUpperCase()}`;vb.className=`vbadge v${r[0].toUpperCase()}`;
  const rp=document.getElementById('rolePill');
  if(r==='admin'){rp.textContent='🛡️ Admin';rp.style.background='var(--purple-lt)';rp.style.color='var(--adm)';rp.style.border='1px solid var(--adm)';}
  else if(r==='doctor'){rp.textContent='👨‍⚕️ Doctor';rp.style.background='var(--sky-lt)';rp.style.color='var(--doc)';rp.style.border='1px solid var(--doc)';}
  else{rp.textContent='🔬 Lab Tech';rp.style.background='var(--teal-lt)';rp.style.color='var(--lab)';rp.style.border='1px solid var(--lab)';}
  show('nAdmS',r==='admin');show('nAdmD',r==='admin');show('nUsers',r==='admin');
  show('nDocS',r==='doctor');show('nDocD',r==='doctor');
  show('nLabS',r==='lab');show('nLabD',r==='lab');
  show('nTests',r==='admin'||r==='lab');
  show('nRes',r==='admin'||r==='lab');
  show('nBill',r==='admin'||r==='doctor');
  show('btnExp',r==='admin');show('btnImp',r==='admin');
  if(r==='doctor'){document.getElementById('patTitle').textContent='My Patients';document.getElementById('ordTitle').textContent='My Orders';document.getElementById('nPatsLbl').textContent='My Patients';document.getElementById('nOrdsLbl').textContent='My Orders';}
  else if(r==='lab'){document.getElementById('nOrdsLbl').textContent='Orders Queue';}
  if(r==='admin') nav('admDash');
  else if(r==='doctor') nav('docDash');
  else nav('labDash');
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════
const PT={'admDash':'Admin Dashboard','users':'User Management','docDash':'My Dashboard','labDash':'Lab Dashboard','patients':'Patients','tests':'Tests Catalog','orders':'Lab Orders','results':'Lab Results','billing':'Billing & Invoices','report':'Print Report'};
function nav(page){
  if(page==='billing'&&CU.role==='lab'){toast('Lab workers have no billing access','error');return;}
  if(page==='results'&&CU.role==='doctor'){toast('Results are managed by lab staff','warn');return;}
  if(page==='users'&&CU.role!=='admin'){toast('Admin only','error');return;}
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  const vEl=document.getElementById(page+'-view');if(vEl)vEl.classList.add('active');
  const ni=document.querySelector(`[onclick="nav('${page}')"]`);if(ni)ni.classList.add('active');
  document.getElementById('pageTitle').textContent=PT[page]||page;
  closeSB();
  const fn={admDash:renderAdmDash,users:renderUsers,docDash:renderDocDash,labDash:renderLabDash,patients:renderPatients,tests:()=>{renderTests();fillTDeptF();},orders:renderOrders,results:renderResults,billing:renderBilling,report:populateRepSel};
  if(fn[page])fn[page]();
}

// ═══════════════════════════════════════
// SIDEBAR MOBILE
// ═══════════════════════════════════════
function toggleSB(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sbOverlay').classList.toggle('on');}
function closeSB(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sbOverlay').classList.remove('on');}

// ═══════════════════════════════════════
// DATES
// ═══════════════════════════════════════
function setDates(){
  const d=new Date();
  document.getElementById('topDate').textContent=d.toLocaleDateString('en-GB',{weekday:'short',year:'numeric',month:'short',day:'numeric'});
  document.getElementById('footDate').textContent=d.toLocaleDateString('en-GB');
}

// ═══════════════════════════════════════
// KPI HELPER
// ═══════════════════════════════════════
function renderKPIs(cid,kpis){
  document.getElementById(cid).innerHTML=kpis.map(k=>`
    <div class="kCard"><div class="kTop"><div class="kIco" style="background:${k.bg};color:${k.col}">${k.ico}</div></div>
    <div class="kVal" style="color:${k.col}">${k.val}</div><div class="kLbl">${k.lbl}</div></div>`).join('');
}

// ═══════════════════════════════════════
// BAR CHART HELPER
// ═══════════════════════════════════════
function renderBar(cid,data,colors,pre=''){
  const el=document.getElementById(cid);if(!el)return;
  const vals=Object.values(data),mx=Math.max(...vals,1);
  el.innerHTML=Object.entries(data).map(([l,v],i)=>`
    <div class="bI"><div class="bLbl" title="${esc(l)}">${esc(l)}</div>
    <div class="bTr"><div class="bFil" style="width:${Math.round(v/mx*100)}%;background:${colors[i%colors.length]}"></div></div>
    <div class="bVl">${pre}${v}</div></div>`).join('')||'<div style="color:var(--gray4);font-size:11px">No data</div>';
}

// ═══════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════
function renderAdmDash(){
  const users=ld('users'),pats=ld('patients'),ords=ld('orders'),bill=ld('billing');
  const rev=bill.reduce((s,x)=>s+Number(x.total||0),0);
  const pend=ords.filter(o=>o.status==='Pending'||o.status==='In Progress').length;
  renderKPIs('admKPI',[
    {lbl:'Total Users',    val:users.length,             ico:'👥',col:'var(--adm)',   bg:'var(--purple-lt)'},
    {lbl:'Total Patients', val:pats.length,              ico:'👤',col:'var(--doc)',   bg:'var(--sky-lt)'},
    {lbl:'Active Orders',  val:pend,                     ico:'📋',col:'var(--orange2)',bg:'var(--orange-lt)'},
    {lbl:'Revenue (₪)',    val:'₪'+rev.toLocaleString(),ico:'💰',col:'var(--green2)',bg:'var(--green-lt)'},
  ]);
  const depts={};ld('tests').forEach(t=>{depts[t.dept]=(depts[t.dept]||0)+1;});
  renderBar('deptChart',depts,['#1565C0','#00695C','#4A148C','#E65100','#B71C1C','#1B5E20','#D32F2F','#6A1B9A']);
  const revcats={};bill.forEach(b=>{const n=b.patient.split(' ')[0];revcats[n]=(revcats[n]||0)+Number(b.total||0);});
  renderBar('revChart',revcats,['#2E7D32','#1565C0','#E65100','#4A148C','#C62828'],'₪');
  document.getElementById('recentUsers').innerHTML=users.slice(-5).reverse().map(u=>`
    <tr><td class="tM">${esc(u.username)}</td><td class="tN">${esc(u.name)}</td><td>${rBadge(u.role)}</td>
    <td><span class="badge ${u.status==='Active'?'bG':'bR'}">${esc(u.status)}</span></td>
    <td class="tM">${fmtD(u.created)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty"><p>No users</p></td></tr>';
  document.getElementById('recentOrdsAdm').innerHTML=ords.slice(-5).reverse().map(o=>`
    <tr><td class="tM">${esc(o.id)}</td><td class="tN">${esc(o.patient)}</td>
    <td style="font-size:11px">${esc(o.doctor)}</td><td>${sBadge(o.status)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty"><p>No orders</p></td></tr>';
}

// ═══════════════════════════════════════
// DOCTOR DASHBOARD
// ═══════════════════════════════════════
function renderDocDash(){
  const mp=ld('patients').filter(p=>p.ownerId===CU.id);
  const mo=ld('orders').filter(o=>o.doctorId===CU.id);
  const mb=ld('billing').filter(b=>b.doctorId===CU.id);
  const pend=mo.filter(o=>o.status==='Pending'||o.status==='In Progress').length;
  const outs=mb.reduce((s,b)=>s+(Number(b.total||0)-Number(b.paid||0)),0);
  renderKPIs('docKPI',[
    {lbl:'My Patients',    val:mp.length,  ico:'👤',col:'var(--doc)',   bg:'var(--sky-lt)'},
    {lbl:'My Orders',      val:mo.length,  ico:'📋',col:'var(--teal)',  bg:'var(--teal-lt)'},
    {lbl:'Pending Orders', val:pend,       ico:'⏳',col:'var(--orange2)',bg:'var(--orange-lt)'},
    {lbl:'Outstanding (₪)',val:'₪'+outs,  ico:'💰',col:outs>0?'var(--red2)':'var(--green2)',bg:outs>0?'var(--red-lt)':'var(--green-lt)'},
  ]);
  document.getElementById('drPatTbl').innerHTML=mp.slice(-5).reverse().map(p=>`
    <tr><td class="tM">${esc(p.id)}</td><td class="tNC" onclick="openProf('${esc(p.id)}')">${esc(p.name)}</td>
    <td>${p.gender?`<span class="badge ${p.gender==='Male'?'bB':'bP'}">${esc(p.gender)}</span>`:''}</td>
    <td class="tM">${esc(p.phone||'—')}</td><td class="tM">${fmtD(p.date)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty"><span class="eIco">👤</span><p>No patients yet</p></td></tr>';
  document.getElementById('drOrdTbl').innerHTML=mo.slice(-5).reverse().map(o=>`
    <tr><td class="tM">${esc(o.id)}</td><td class="tN">${esc(o.patient)}</td>
    <td style="font-size:10px">${getTests(o).slice(0,2).map(t=>esc(t)).join(', ')}${getTests(o).length>2?' ...':''}</td>
    <td>${sBadge(o.status)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty"><p>No orders yet</p></td></tr>';
}

// ═══════════════════════════════════════
// LAB DASHBOARD
// ═══════════════════════════════════════
function renderLabDash(){
  const sh=ldOne('curShift')||{id:'—',labUser:CU.username,labName:CU.name,startDate:tod(),startTime:nowT(),ordersProcessed:0,resultsEntered:0,patientsAdded:0};
  document.getElementById('shiftLbl').textContent=sh.id;
  document.getElementById('shiftInfo').textContent=`Started: ${fmtD(sh.startDate)} at ${sh.startTime} · Tech: ${sh.labName||sh.labUser}`;
  document.getElementById('shiftStats').innerHTML=`
    <div class="shSt"><div class="sN">${sh.ordersProcessed||0}</div><div class="sL">Orders Processed</div></div>
    <div class="shSt"><div class="sN">${sh.resultsEntered||0}</div><div class="sL">Results Entered</div></div>
    <div class="shSt"><div class="sN">${sh.patientsAdded||0}</div><div class="sL">Patients Added</div></div>
    <div class="shSt"><div class="sN" style="color:#90CAF9">${sh.startTime||'—'}</div><div class="sL">Shift Start</div></div>`;
  const allOrds=ld('orders');
  const pend=allOrds.filter(o=>o.status==='Pending'||o.status==='In Progress').length;
  renderKPIs('labKPI',[
    {lbl:'Total Orders',   val:allOrds.length,         ico:'📋',col:'var(--lab)',   bg:'var(--teal-lt)'},
    {lbl:'Pending/Active', val:pend,                   ico:'⏳',col:'var(--orange2)',bg:'var(--orange-lt)'},
    {lbl:'Completed',      val:allOrds.filter(o=>o.status==='Completed').length,ico:'✅',col:'var(--green2)',bg:'var(--green-lt)'},
    {lbl:'Total Patients', val:ld('patients').length,  ico:'👥',col:'var(--doc)',   bg:'var(--sky-lt)'},
  ]);
  document.getElementById('labPendOrds').innerHTML=allOrds.filter(o=>o.status!=='Completed'&&o.status!=='Cancelled').slice(0,10).map(o=>`
    <tr><td class="tM">${esc(o.id)}</td><td class="tN">${esc(o.patient)}</td><td style="font-size:11px">${esc(o.doctor)}</td>
    <td style="font-size:10px">${getTests(o).map(t=>esc(t)).join(', ')}</td>
    <td>${pBadge(o.priority||'Routine')}</td><td>${sBadge(o.status)}</td>
    <td><button class="ab abO" onclick="openAddResult('${esc(o.id)}')">🔬 Enter</button></td></tr>`).join('')||
    '<tr><td colspan="7" class="empty"><span class="eIco">✅</span><p>All orders processed!</p></td></tr>';
}

// ═══════════════════════════════════════
// SHIFT
// ═══════════════════════════════════════
function openNewShift(){openM('shiftModal');sV('smUser','');sV('smPass','');document.getElementById('smErr').classList.remove('show');}
function confirmShift(){
  const u=gV('smUser').trim(),p=gV('smPass');
  const err=document.getElementById('smErr');err.classList.remove('show');
  const found=ld('users').find(x=>x.username===u&&x.password===p&&x.role==='lab'&&x.status==='Active');
  if(!found){err.classList.add('show');return;}
  const shifts=ld('shifts'),old=ldOne('curShift');
  if(old){old.endDate=tod();old.endTime=nowT();shifts.push(old);sv('shifts',shifts);}
  const nid=genID('SH',shifts.concat(old?[old]:[]));
  svOne('curShift',{id:nid,labUser:found.username,labName:found.name,startDate:tod(),startTime:nowT(),ordersProcessed:0,resultsEntered:0,patientsAdded:0});
  closeM('shiftModal');toast(`✅ New shift ${nid} started`);renderLabDash();
}
function incShift(stat,by=1){const s=ldOne('curShift');if(s){s[stat]=(s[stat]||0)+by;svOne('curShift',s);}}

// ═══════════════════════════════════════
// USERS CRUD
// ═══════════════════════════════════════
function renderUsers(){
  const q=gV('uSrch').toLowerCase(),rf=gV('uRoleF');
  const filtered=ld('users').filter(u=>(!q||(u.username+u.name+u.specialty+u.dept).toLowerCase().includes(q))&&(!rf||u.role===rf));
  document.getElementById('uCount').textContent=filtered.length;
  document.getElementById('usersTbl').innerHTML=filtered.length?filtered.map(u=>`
    <tr><td class="tM">${esc(u.username)}</td><td class="tN">${esc(u.name)}</td><td>${rBadge(u.role)}</td>
    <td style="font-size:11px">${esc(u.specialty||u.labDept||u.dept||'—')}</td>
    <td class="tM">${esc(u.phone||'—')}</td>
    <td><span class="badge ${u.status==='Active'?'bG':'bR'}">${esc(u.status)}</span></td>
    <td><button class="ab abE" onclick="editUser('${esc(u.id)}')">✏ Edit</button><button class="ab abD" onclick="delUser('${esc(u.id)}')">🗑</button></td></tr>`).join('')
    :'<tr><td colspan="7" class="empty"><span class="eIco">👥</span><p>No users found</p></td></tr>';
}
function toggleUFields(){
  const r=gV('umRole');
  show('umSpecFd',r==='doctor');show('umLicFd',r==='doctor');show('umDeptFd',r==='doctor');
  show('umLabDFd',r==='lab');
}
function openAddUser(def='doctor'){
  document.getElementById('umTitle').textContent='👥 Add New User';
  document.getElementById('umIdH').value='';
  ['umName','umUser','umPass','umSpec','umLic','umDept','umPhone','umEmail','umNotes'].forEach(id=>sV(id,''));
  sV('umRole',def);sV('umStatus','Active');toggleUFields();openM('userModal');
}
function editUser(id){
  const u=ld('users').find(x=>x.id===id);if(!u)return;
  document.getElementById('umTitle').textContent='✏ Edit User';
  document.getElementById('umIdH').value=id;
  sV('umRole',u.role);sV('umStatus',u.status);sV('umName',u.name);sV('umUser',u.username);sV('umPass',u.password);
  sV('umSpec',u.specialty||'');sV('umLic',u.lic||'');sV('umDept',u.dept||'');sV('umLabD',u.labDept||'');
  sV('umPhone',u.phone||'');sV('umEmail',u.email||'');sV('umNotes',u.notes||'');
  toggleUFields();openM('userModal');
}
function saveUser(){
  const name=gV('umName').trim(),uname=gV('umUser').trim().toLowerCase(),pass=gV('umPass').trim();
  if(!name){toast('Name required','error');return;}
  if(!uname){toast('Username required','error');return;}
  if(!pass){toast('Password required','error');return;}
  const users=ld('users'),idH=gV('umIdH'),role=gV('umRole');
  if(users.find(x=>x.username===uname&&x.id!==idH)){toast('Username already taken','error');return;}
  const obj={id:idH||genID('U',users),username:uname,password:pass,role,name,specialty:gV('umSpec'),lic:gV('umLic'),dept:gV('umDept'),labDept:gV('umLabD'),phone:gV('umPhone'),email:gV('umEmail'),notes:gV('umNotes'),status:gV('umStatus'),created:idH?users.find(x=>x.id===idH)?.created||tod():tod()};
  if(idH){const i=users.findIndex(x=>x.id===idH);if(i>=0)users[i]=obj;else users.push(obj);}else users.push(obj);
  sv('users',users);closeM('userModal');renderUsers();toast(idH?'✅ User updated':'✅ User created — they can now log in');
}
function delUser(id){conf2('Delete User','Delete this user account? Data is preserved.',()=>{sv('users',ld('users').filter(x=>x.id!==id));renderUsers();toast('User deleted');});}
function genPass(){const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';let p='';for(let i=0;i<10;i++)p+=c[Math.floor(Math.random()*c.length)];sV('umPass',p);}

// ═══════════════════════════════════════
// PATIENTS CRUD
// ═══════════════════════════════════════
function renderPatients(){
  const q=gV('pSrch').toLowerCase(),gf=gV('pGenderF');
  let pats=ld('patients');
  if(CU.role==='doctor') pats=pats.filter(p=>p.ownerId===CU.id);
  const f=pats.filter(p=>(!q||(p.name+p.id+p.phone+p.address).toLowerCase().includes(q))&&(!gf||p.gender===gf));
  document.getElementById('pCount').textContent=f.length;
  document.getElementById('patsTbl').innerHTML=f.length?f.map(p=>`
    <tr><td class="tM">${esc(p.id)}</td>
    <td class="tNC" onclick="openProf('${esc(p.id)}')">${esc(p.name)}</td>
    <td class="tM">${p.age?p.age+'y':'—'}</td>
    <td>${p.gender?`<span class="badge ${p.gender==='Male'?'bB':'bP'}">${esc(p.gender)}</span>`:''}</td>
    <td><span class="badge bGr">${esc(p.blood||'—')}</span></td>
    <td class="tM">${esc(p.phone||'—')}</td>
    <td><span class="badge ${p.type==='outpatient'?'bO':'bT'}">${p.type==='outpatient'?'Outpatient':'Regular'}</span></td>
    <td style="font-size:10px;color:var(--gray5)">${esc(p.ownerName||'Admin')}</td>
    <td class="tM">${fmtD(p.date)}</td>
    <td><button class="ab abV" onclick="openProf('${esc(p.id)}')">👁</button><button class="ab abE" onclick="editPat('${esc(p.id)}')">✏</button>${CU.role==='admin'?`<button class="ab abD" onclick="delPat('${esc(p.id)}')">🗑</button>`:''}</td></tr>`).join('')
  :'<tr><td colspan="10" class="empty"><span class="eIco">👤</span><p>No patients found</p></td></tr>';
}
function openAddPatient(){
  document.getElementById('pmTitle').textContent='👤 New Patient';document.getElementById('pmIdH').value='';
  ['pmId','pmName','pmDob','pmPhone','pmEmail','pmAddr','pmIns','pmNotes'].forEach(id=>sV(id,''));
  sV('pmDate',tod());sV('pmGender','');sV('pmBlood','');sV('pmAge','');sV('pmType','regular');
  sV('pmId',genID('P',ld('patients')));openM('patModal');
}
function editPat(id){
  const p=ld('patients').find(x=>x.id===id);if(!p)return;
  document.getElementById('pmTitle').textContent='✏ Edit Patient';document.getElementById('pmIdH').value=id;
  sV('pmId',p.id);sV('pmDate',p.date);sV('pmName',p.name);sV('pmDob',p.dob);sV('pmAge',p.age);
  sV('pmGender',p.gender);sV('pmBlood',p.blood);sV('pmPhone',p.phone);sV('pmEmail',p.email);
  sV('pmAddr',p.address);sV('pmIns',p.ins);sV('pmType',p.type||'regular');sV('pmNotes',p.notes);openM('patModal');
}
function savePat(){
  const name=gV('pmName').trim();if(!name){toast('Name required','error');return;}
  const pats=ld('patients'),idH=gV('pmIdH');
  const obj={id:gV('pmId')||genID('P',pats),name,dob:gV('pmDob'),age:gV('pmAge'),gender:gV('pmGender'),blood:gV('pmBlood'),phone:gV('pmPhone'),email:gV('pmEmail'),address:gV('pmAddr'),ins:gV('pmIns'),type:gV('pmType'),notes:gV('pmNotes'),date:gV('pmDate')||tod(),ownerId:idH?pats.find(x=>x.id===idH)?.ownerId||CU.id:CU.id,ownerName:idH?pats.find(x=>x.id===idH)?.ownerName||CU.name:CU.name,ownerRole:idH?pats.find(x=>x.id===idH)?.ownerRole||CU.role:CU.role};
  if(idH){const i=pats.findIndex(x=>x.id===idH);if(i>=0)pats[i]=obj;else pats.push(obj);}else{pats.push(obj);if(CU.role==='lab')incShift('patientsAdded');}
  sv('patients',pats);closeM('patModal');renderPatients();toast(idH?'✅ Patient updated':'✅ Patient registered');
}
function delPat(id){conf2('Delete Patient','Permanently delete this patient record?',()=>{sv('patients',ld('patients').filter(x=>x.id!==id));renderPatients();toast('Patient deleted');});}

// ═══════════════════════════════════════
// PATIENT PROFILE
// ═══════════════════════════════════════
function openProf(pid){
  const p=ld('patients').find(x=>x.id===pid);if(!p){toast('Patient not found','error');return;}
  const ords=ld('orders').filter(o=>o.patientId===pid||o.patient===p.name);
  const res=ld('results').filter(r=>r.patientId===pid||r.patient===p.name);
  const bills=ld('billing').filter(b=>b.patientId===pid||b.patient===p.name);
  const billed=bills.reduce((s,b)=>s+Number(b.total||0),0);
  const paid=bills.reduce((s,b)=>s+Number(b.paid||0),0);
  const abn=res.filter(r=>r.flag==='H'||r.flag==='L').length;
  document.getElementById('profContent').innerHTML=`
    <div class="pHd"><div class="pAv">${p.gender==='Female'?'👩':'👤'}</div>
    <div class="pIn"><h2>${esc(p.name)}</h2><p>${esc(p.id)} · ${esc(p.phone||'No phone')} · ${esc(p.address||'—')}</p>
    <div class="pMet">${p.gender?`<span>${esc(p.gender)}</span>`:''} ${p.age?`<span>Age ${esc(p.age)}</span>`:''} ${p.blood?`<span>Blood: ${esc(p.blood)}</span>`:''} ${p.ins?`<span>Ins: ${esc(p.ins)}</span>`:''}<span>${p.type==='outpatient'?'Outpatient':'Regular'}</span><span>Reg: ${fmtD(p.date)}</span></div></div></div>
    <div class="pTabs">
      <div class="pTab active" onclick="swPTab(this,'pti')">📋 Info</div>
      <div class="pTab" onclick="swPTab(this,'pto')">📋 Orders (${ords.length})</div>
      <div class="pTab" onclick="swPTab(this,'ptr')">🔬 Results (${res.length})</div>
      <div class="pTab" onclick="swPTab(this,'ptb')">💰 Billing (${bills.length})</div>
    </div>
    <div class="pTC active" id="pti">
      <div class="pStat">
        <div class="ps"><div class="n" style="color:var(--blue)">${ords.length}</div><div class="l">Orders</div></div>
        <div class="ps"><div class="n" style="color:var(--green2)">${res.length}</div><div class="l">Results</div></div>
        <div class="ps"><div class="n" style="color:${abn>0?'var(--red2)':'var(--green2)'}">${abn}</div><div class="l">Abnormal</div></div>
        <div class="ps"><div class="n" style="color:var(--orange2)">₪${billed}</div><div class="l">Billed</div></div>
        <div class="ps"><div class="n" style="color:${(billed-paid)>0?'var(--red2)':'var(--green2)'}">₪${billed-paid}</div><div class="l">Balance</div></div>
      </div>
      <div class="iGrid">
        ${[['Full Name',p.name],['Patient ID',p.id],['Date of Birth',fmtD(p.dob)||'—'],['Age',p.age?p.age+' years':'—'],['Gender',p.gender||'—'],['Blood Type',p.blood||'—'],['Phone',p.phone||'—'],['Insurance',p.ins||'—']].map(([l,v])=>`<div class="iRow"><span class="iLbl">${l}</span><span class="iVal">${esc(v)}</span></div>`).join('')}
        <div class="iRow" style="grid-column:span 2"><span class="iLbl">Address</span><span class="iVal">${esc(p.address||'—')}</span></div>
        <div class="iRow" style="grid-column:span 2"><span class="iLbl">Notes</span><span class="iVal">${esc(p.notes||'—')}</span></div>
        <div class="iRow"><span class="iLbl">Added By</span><span class="iVal">${esc(p.ownerName||'—')}</span></div>
        <div class="iRow"><span class="iLbl">Registered</span><span class="iVal">${fmtD(p.date)}</span></div>
      </div>
    </div>
    <div class="pTC" id="pto">${ords.length?`<table class="mT"><thead><tr><th>Order ID</th><th>Date</th><th>Doctor</th><th>Tests</th><th>Status</th></tr></thead><tbody>${ords.map(o=>`<tr><td class="tM">${esc(o.id)}</td><td class="tM">${fmtD(o.date)}</td><td>${esc(o.doctor)}</td><td style="font-size:10px">${getTests(o).join(', ')}</td><td>${sBadge(o.status)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty"><span class="eIco">📋</span><p>No orders</p></div>'}</div>
    <div class="pTC" id="ptr">${res.length?`<table class="mT"><thead><tr><th>Test</th><th>Parameter</th><th>Value</th><th>Unit</th><th>Range</th><th>Flag</th><th>Date</th></tr></thead><tbody>${res.map(r=>`<tr><td>${esc(r.testName)}</td><td style="font-size:10px;color:var(--gray5)">${esc(r.paramName||'—')}</td><td class="tM"><b>${esc(r.value)}</b></td><td style="font-size:10px">${esc(r.unit)}</td><td style="font-size:10px">${esc(r.norm)}</td><td>${flagEl(r.flag)}</td><td class="tM">${fmtD(r.date)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty"><span class="eIco">🔬</span><p>No results yet</p></div>'}</div>
    <div class="pTC" id="ptb">${bills.length?`<table class="mT"><thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${bills.map(b=>`<tr><td class="tM">${esc(b.id)}</td><td class="tM">${fmtD(b.date)}</td><td class="tPr">₪${Number(b.total||0)}</td><td style="color:var(--green2);font-weight:700">₪${Number(b.paid||0)}</td><td style="color:${(Number(b.total||0)-Number(b.paid||0))>0?'var(--red2)':'var(--green2)'};font-weight:700">₪${Number(b.total||0)-Number(b.paid||0)}</td><td>${Number(b.paid||0)>=Number(b.total||0)?'<span class="badge bG">Paid</span>':'<span class="badge bR">Unpaid</span>'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty"><span class="eIco">💰</span><p>No billing</p></div>'}</div>`;
  document.getElementById('profEditBtn').onclick=()=>{closeM('profModal');editPat(pid);};
  openM('profModal');
}
function swPTab(el,tid){
  el.closest('.mXl').querySelectorAll('.pTab').forEach(t=>t.classList.remove('active'));
  el.closest('.mXl').querySelectorAll('.pTC').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');document.getElementById(tid).classList.add('active');
}

// ═══════════════════════════════════════
// TESTS CRUD
// ═══════════════════════════════════════
function fillTDeptF(){
  const sel=document.getElementById('tDeptF');
  const depts=[...new Set(ld('tests').map(t=>t.dept))].sort();
  sel.innerHTML='<option value="">All Departments</option>'+depts.map(d=>`<option>${esc(d)}</option>`).join('');
}
function renderTests(){
  const q=gV('tSrch').toLowerCase(),df=gV('tDeptF');
  const f=ld('tests').filter(t=>(!q||(t.name+t.id+t.dept).toLowerCase().includes(q))&&(!df||t.dept===df));
  document.getElementById('tCount').textContent=f.length;
  document.getElementById('testsTbl').innerHTML=f.length?f.map(t=>`
    <tr><td class="tM">${esc(t.id)}</td><td class="tN">${esc(t.name)}</td>
    <td><span class="badge bT">${esc(t.dept)}</span></td>
    <td style="font-size:10px">${esc(t.sample||'—')}</td>
    <td class="tPr">₪${Number(t.price||0)}</td>
    <td class="tM">${esc(t.tat||'—')}h</td>
    <td style="font-size:10px">${esc(t.norm||'—')}</td>
    <td><span class="badge ${t.params&&t.params.length>0?'bP':'bGr'}">${t.params&&t.params.length>0?t.params.length+' params':'Simple'}</span></td>
    <td><span class="badge ${t.status==='Active'?'bG':'bR'}">${esc(t.status)}</span></td>
    <td><button class="ab abE" onclick="editTest('${esc(t.id)}')">✏ Edit</button>${CU.role==='admin'?`<button class="ab abD" onclick="delTest('${esc(t.id)}')">🗑</button>`:''}</td></tr>`).join('')
  :'<tr><td colspan="10" class="empty"><span class="eIco">🧪</span><p>No tests</p></td></tr>';
}
function addParamRow(n='',u='',nm='',nf=''){
  const c=document.getElementById('paramsBox'),row=document.createElement('div');row.className='pRow';
  row.innerHTML=`<input type="text" placeholder="Parameter name" value="${esc(n)}" class="pN"/><input type="text" placeholder="Unit" value="${esc(u)}" class="pU"/><input type="text" placeholder="Normal (M)" value="${esc(nm)}" class="pNm"/><input type="text" placeholder="Normal (F)" value="${esc(nf)}" class="pNf"/><button type="button" class="rmBtn" onclick="this.closest('.pRow').remove()">✕</button>`;
  c.appendChild(row);
}
function openAddTest(){
  document.getElementById('tmTitle').textContent='🧪 Add New Test';document.getElementById('tmIdH').value='';
  ['tmId','tmName','tmUnit','tmNorm','tmNormM','tmNormF','tmMethod','tmNotes','tmTat','tmPrice'].forEach(id=>sV(id,''));
  sV('tmDept','Chemistry');sV('tmSample','Blood (Serum)');sV('tmStatus','Active');
  sV('tmId',genID('T',ld('tests')));document.getElementById('paramsBox').innerHTML='';openM('testModal');
}
function editTest(id){
  const t=ld('tests').find(x=>x.id===id);if(!t)return;
  document.getElementById('tmTitle').textContent='✏ Edit Test';document.getElementById('tmIdH').value=id;
  sV('tmId',t.id);sV('tmStatus',t.status);sV('tmName',t.name);sV('tmDept',t.dept);sV('tmSample',t.sample||'Blood (Serum)');
  sV('tmPrice',t.price);sV('tmTat',t.tat);sV('tmUnit',t.unit);sV('tmMethod',t.method||'');
  sV('tmNorm',t.norm);sV('tmNormM',t.normM||'');sV('tmNormF',t.normF||'');sV('tmNotes',t.notes||'');
  document.getElementById('paramsBox').innerHTML='';
  if(t.params&&t.params.length)t.params.forEach(p=>addParamRow(p.name,p.unit,p.normM,p.normF));openM('testModal');
}
function saveTest(){
  const name=gV('tmName').trim();if(!name){toast('Test name required','error');return;}
  const rows=document.getElementById('paramsBox').querySelectorAll('.pRow');
  const params=[...rows].map(r=>({name:r.querySelector('.pN')?.value.trim()||'',unit:r.querySelector('.pU')?.value.trim()||'',normM:r.querySelector('.pNm')?.value.trim()||'',normF:r.querySelector('.pNf')?.value.trim()||''})).filter(p=>p.name);
  const tests=ld('tests'),idH=gV('tmIdH');
  const obj={id:gV('tmId')||genID('T',tests),name,status:gV('tmStatus'),dept:gV('tmDept'),sample:gV('tmSample'),price:parseFloat(gV('tmPrice'))||0,tat:gV('tmTat'),unit:gV('tmUnit'),method:gV('tmMethod'),norm:gV('tmNorm'),normM:gV('tmNormM'),normF:gV('tmNormF'),notes:gV('tmNotes'),params};
  if(idH){const i=tests.findIndex(x=>x.id===idH);if(i>=0)tests[i]=obj;else tests.push(obj);}else tests.push(obj);
  sv('tests',tests);closeM('testModal');renderTests();toast(idH?'✅ Test updated':'✅ Test added');
}
function delTest(id){conf2('Delete Test','Remove test from catalog?',()=>{sv('tests',ld('tests').filter(x=>x.id!==id));renderTests();toast('Test removed');});}

// ═══════════════════════════════════════
// ORDERS CRUD
// ═══════════════════════════════════════
function renderOrders(){
  const q=gV('oSrch').toLowerCase(),sf=gV('oStatF'),pf=gV('oPriF');
  let ords=ld('orders');
  if(CU.role==='doctor') ords=ords.filter(o=>o.doctorId===CU.id);
  const f=ords.filter(o=>(!q||(o.id+o.patient+o.doctor).toLowerCase().includes(q))&&(!sf||o.status===sf)&&(!pf||o.priority===pf)).sort((a,b)=>b.id.localeCompare(a.id));
  document.getElementById('ordsTbl').innerHTML=f.length?f.map(o=>`
    <tr><td class="tM">${esc(o.id)}</td><td class="tM">${fmtD(o.date)}</td><td class="tN">${esc(o.patient)}</td>
    <td style="font-size:11px">${esc(o.doctor)}</td>
    <td style="font-size:10px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(getTests(o).join(', '))}">${getTests(o).map(t=>`<span class="badge bGr" style="margin:1px">${esc(t)}</span>`).join('')||'—'}</td>
    <td>${pBadge(o.priority||'Routine')}</td><td>${sBadge(o.status)}</td>
    <td>${(CU.role==='lab'||CU.role==='admin')?`<button class="ab abO" onclick="openAddResult('${esc(o.id)}')">🔬</button>`:''}
    <button class="ab abE" onclick="editOrder('${esc(o.id)}')">✏</button>
    <button class="ab abD" onclick="delOrder('${esc(o.id)}')">🗑</button></td></tr>`).join('')
  :'<tr><td colspan="8" class="empty"><span class="eIco">📋</span><p>No orders found</p></td></tr>';
}
function addTestRow(){
  const c=document.getElementById('ordTestsList'),tests=ld('tests').filter(t=>t.status==='Active'),i=c.querySelectorAll('.oTR').length+1;
  const row=document.createElement('div');row.className='oTR';
  row.innerHTML=`<span class="tNum">${i}</span><select style="flex:1;border:1.5px solid var(--gray2);border-radius:5px;padding:6px 8px;font-size:12px;font-family:inherit;outline:none"><option value="">Select test...</option>${tests.map(t=>`<option value="${esc(t.name)}">${esc(t.name)} (₪${t.price})</option>`).join('')}</select><button type="button" class="rmBtn" onclick="this.closest('.oTR').remove()">✕</button>`;
  c.appendChild(row);
}
function populateOrdModal(){
  let pats=ld('patients');if(CU.role==='doctor') pats=pats.filter(p=>p.ownerId===CU.id);
  document.getElementById('omPat').innerHTML='<option value="">Select patient...</option>'+pats.map(p=>`<option value="${esc(p.name)}">${esc(p.name)} (${esc(p.id)})</option>`).join('');
  const docSel=document.getElementById('omDoc');
  if(CU.role==='doctor'){docSel.innerHTML=`<option value="${esc(CU.name)}">${esc(CU.name)}</option>`;docSel.disabled=true;}
  else{const docs=ld('users').filter(u=>u.role==='doctor'&&u.status==='Active');docSel.innerHTML='<option value="">Select doctor...</option>'+docs.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');if(CU.role==='lab')docSel.innerHTML+=`<option value="${esc(CU.name)}">${esc(CU.name)} (Lab)</option>`;docSel.disabled=false;}
}
function openAddOrder(){
  document.getElementById('omTitle').textContent='📋 New Lab Order';document.getElementById('omIdH').value='';
  sV('omId',genID('ORD',ld('orders')));sV('omDate',tod());sV('omStat','Pending');sV('omPri','Routine');sV('omNotes','');
  populateOrdModal();document.getElementById('ordTestsList').innerHTML='';addTestRow();openM('ordModal');
}
function editOrder(id){
  const o=ld('orders').find(x=>x.id===id);if(!o)return;
  document.getElementById('omTitle').textContent='✏ Edit Order';document.getElementById('omIdH').value=id;
  sV('omId',o.id);sV('omDate',o.date);sV('omStat',o.status);sV('omPri',o.priority||'Routine');sV('omNotes',o.notes);
  populateOrdModal();sV('omPat',o.patient);sV('omDoc',o.doctor);
  const tests=ld('tests').filter(t=>t.status==='Active'),c=document.getElementById('ordTestsList');c.innerHTML='';
  getTests(o).forEach((tn,i)=>{const row=document.createElement('div');row.className='oTR';row.innerHTML=`<span class="tNum">${i+1}</span><select style="flex:1;border:1.5px solid var(--gray2);border-radius:5px;padding:6px 8px;font-size:12px;font-family:inherit;outline:none"><option value="">Select...</option>${tests.map(t=>`<option value="${esc(t.name)}" ${t.name===tn?'selected':''}>${esc(t.name)} (₪${t.price})</option>`).join('')}</select><button type="button" class="rmBtn" onclick="this.closest('.oTR').remove()">✕</button>`;c.appendChild(row);});
  if(!getTests(o).length)addTestRow();openM('ordModal');
}
function saveOrder(){
  const pat=gV('omPat'),doc=gV('omDoc');
  if(!pat){toast('Select a patient','error');return;}if(!doc){toast('Select a doctor','error');return;}
  const rows=document.getElementById('ordTestsList').querySelectorAll('.oTR select');
  const tests=[...rows].map(s=>s.value).filter(Boolean);
  if(!tests.length){toast('Add at least one test','error');return;}
  const ords=ld('orders'),idH=gV('omIdH');
  const docU=ld('users').find(u=>u.name===doc);
  const patO=ld('patients').find(p=>p.name===pat);
  const sh=ldOne('curShift');
  const resolvedDocId = docU ? docU.id : (CU.role==='doctor'||CU.role==='lab') ? CU.id : '';
  const obj={id:gV('omId')||genID('ORD',ords),date:gV('omDate')||tod(),patient:pat,patientId:patO?.id||'',doctorId:resolvedDocId,doctor:doc,tests,status:gV('omStat'),priority:gV('omPri')||'Routine',notes:gV('omNotes'),shiftId:sh?.id||''};
  if(idH){const i=ords.findIndex(x=>x.id===idH);if(i>=0)ords[i]=obj;else ords.push(obj);}else{ords.push(obj);if(CU.role==='lab')incShift('ordersProcessed');}
  sv('orders',ords);closeM('ordModal');renderOrders();toast(idH?'✅ Order updated':'✅ Order created');
}
function delOrder(id){conf2('Delete Order','Delete this lab order?',()=>{sv('orders',ld('orders').filter(x=>x.id!==id));renderOrders();toast('Order deleted');});}

// ═══════════════════════════════════════
// RESULTS CRUD
// ═══════════════════════════════════════
function renderResults(){
  const q=gV('rSrch').toLowerCase(),ff=gV('rFlagF');
  const f=ld('results').filter(r=>(!q||(r.testName+r.paramName+r.patient+r.orderId).toLowerCase().includes(q))&&(!ff||r.flag===ff)).sort((a,b)=>b.id.localeCompare(a.id));
  const H=f.filter(r=>r.flag==='H').length,L=f.filter(r=>r.flag==='L').length,N=f.filter(r=>r.flag==='N').length;
  document.getElementById('resSumm').textContent=`${f.length} results — 🔴 High: ${H}  🔵 Low: ${L}  🟢 Normal: ${N}`;
  document.getElementById('resTbl').innerHTML=f.length?f.map(r=>`
    <tr><td class="tM">${esc(r.id)}</td><td class="tM">${esc(r.orderId||'—')}</td>
    <td style="font-size:11px;font-weight:600">${esc(r.testName)}</td>
    <td style="font-size:10px;color:var(--gray5)">${esc(r.paramName||'—')}</td>
    <td class="tNC" onclick="openProf('${esc(ld('patients').find(p=>p.name===r.patient||p.id===r.patientId)?.id||'')}')">${esc(r.patient)}</td>
    <td class="tM"><b>${esc(r.value)}</b></td><td style="font-size:10px">${esc(r.unit||'—')}</td>
    <td style="font-size:10px">${esc(r.norm||'—')}</td><td>${flagEl(r.flag)}</td>
    <td style="font-size:11px">${esc(r.tech||'—')}</td><td class="tM">${fmtD(r.date)}</td>
    <td><button class="ab abD" onclick="delResult('${esc(r.id)}')">🗑</button></td></tr>`).join('')
  :'<tr><td colspan="12" class="empty"><span class="eIco">🔬</span><p>No results</p></td></tr>';
}
function openAddResult(preOid){
  document.getElementById('rmTitle').textContent='🔬 Enter Lab Results';
  const ords=ld('orders').filter(o=>o.status!=='Cancelled');
  const sel=document.getElementById('rmOrd');
  sel.innerHTML='<option value="">— Select Order —</option>'+ords.map(o=>`<option value="${esc(o.id)}" ${o.id===preOid?'selected':''}>${esc(o.id)} — ${esc(o.patient)} (${getTests(o).length} tests)</option>`).join('');
  sV('rmDate',tod());sV('rmTech',CU.username);sV('rmPat','');sV('rmDoc','');
  document.getElementById('resTestsCont').innerHTML='<div style="text-align:center;color:var(--gray4);padding:28px;border:2px dashed var(--gray2);border-radius:8px;font-size:13px">☝️ Select an order to load tests</div>';
  openM('resModal');if(preOid){sV('rmOrd',preOid);loadOrdForResult();}
}
function loadOrdForResult(){
  const oid=gV('rmOrd');if(!oid){document.getElementById('resTestsCont').innerHTML='<div style="text-align:center;color:var(--gray4);padding:28px;border:2px dashed var(--gray2);border-radius:8px;font-size:13px">☝️ Select an order to load tests</div>';return;}
  const ord=ld('orders').find(o=>o.id===oid);if(!ord)return;
  sV('rmPat',ord.patient);sV('rmDoc',ord.doctor);
  const tests=ld('tests'),existing=ld('results').filter(r=>r.orderId===oid),ordTests=getTests(ord);
  let html='<table class="rET"><thead><tr><th>Test / Parameter</th><th>Value *</th><th>Unit</th><th>Normal Range</th><th>Flag</th><th>Comment</th></tr></thead><tbody>';
  ordTests.forEach(tn=>{
    const tObj=tests.find(t=>t.name===tn);
    if(tObj&&tObj.params&&tObj.params.length>0){
      html+=`<tr style="background:var(--navy2)"><td colspan="6" style="font-size:11px;font-weight:700;color:#90CAF9;padding:7px 10px">${esc(tn)}</td></tr>`;
      tObj.params.forEach(pr=>{
        const ex=existing.find(r=>r.testName===tn&&r.paramName===pr.name);
        html+=`<tr data-t="${esc(tn)}" data-p="${esc(pr.name)}"><td style="padding-left:20px;font-size:11px;color:var(--gray6)">↳ ${esc(pr.name)}</td><td><input class="rI" name="val" type="text" value="${esc(ex?.value||'')}" placeholder="Enter value"/></td><td style="font-size:10px">${esc(pr.unit)}</td><td style="font-size:10px">${esc(pr.normM||pr.normF||tObj.norm||'—')}</td><td><select name="flag" style="padding:4px;font-size:11px;border-radius:5px;border:1px solid var(--gray2)"><option value="N" ${(ex?.flag||'N')==='N'?'selected':''}>N</option><option value="H" ${ex?.flag==='H'?'selected':''}>H</option><option value="L" ${ex?.flag==='L'?'selected':''}>L</option></select></td><td><input class="rI" name="comm" type="text" value="${esc(ex?.comment||'')}" placeholder="Comment"/></td></tr>`;
      });
    }else{
      const ex=existing.find(r=>r.testName===tn&&!r.paramName);
      html+=`<tr data-t="${esc(tn)}" data-p=""><td style="font-size:11px;font-weight:600">${esc(tn)}</td><td><input class="rI" name="val" type="text" value="${esc(ex?.value||'')}" placeholder="Result value"/></td><td style="font-size:10px">${esc(tObj?.unit||'—')}</td><td style="font-size:10px">${esc(tObj?.norm||'—')}</td><td><select name="flag" style="padding:4px;font-size:11px;border-radius:5px;border:1px solid var(--gray2)"><option value="N" ${(ex?.flag||'N')==='N'?'selected':''}>N</option><option value="H" ${ex?.flag==='H'?'selected':''}>H</option><option value="L" ${ex?.flag==='L'?'selected':''}>L</option></select></td><td><input class="rI" name="comm" type="text" value="${esc(ex?.comment||'')}" placeholder="Comment"/></td></tr>`;
    }
  });
  html+='</tbody></table>';
  document.getElementById('resTestsCont').innerHTML=html;
}
function saveResults(){
  const oid=gV('rmOrd');if(!oid){toast('Select an order','error');return;}
  const ord=ld('orders').find(o=>o.id===oid);if(!ord)return;
  const rows=document.getElementById('resTestsCont').querySelectorAll('tbody tr[data-t]');
  if(!rows.length){toast('No test rows','error');return;}
  const tests=ld('tests');
  let results=ld('results').filter(r=>r.orderId!==oid);let count=0;
  rows.forEach(row=>{
    const tn=row.getAttribute('data-t'),pn=row.getAttribute('data-p')||'';
    const val=row.querySelector('[name="val"]')?.value.trim();if(!val)return;
    const flag=row.querySelector('[name="flag"]')?.value||'N',comm=row.querySelector('[name="comm"]')?.value||'';
    const tObj=tests.find(t=>t.name===tn);
    let unit='',norm='';
    if(tObj){if(pn){const p=tObj.params?.find(x=>x.name===pn);unit=p?.unit||'';norm=p?.normM||p?.normF||tObj.norm||'';}else{unit=tObj.unit||'';norm=tObj.norm||'';}}
    results.push({id:genID('R',results),date:gV('rmDate')||tod(),orderId:oid,patient:ord.patient,patientId:ord.patientId||'',testId:tObj?.id||'',testName:tn,paramName:pn,value:val,unit,norm,flag,tech:gV('rmTech')||CU.username,comment:comm});
    count++;
  });
  if(!count){toast('Enter at least one value','error');return;}
  sv('results',results);
  const ords=ld('orders'),oi=ords.findIndex(o=>o.id===oid);
  if(oi>=0&&ords[oi].status!=='Cancelled'){ords[oi].status='Completed';sv('orders',ords);}
  if(CU.role==='lab')incShift('resultsEntered',count);
  closeM('resModal');
  if(document.getElementById('results-view').classList.contains('active'))renderResults();
  if(document.getElementById('labDash-view').classList.contains('active'))renderLabDash();
  toast(`✅ ${count} results saved — order marked Completed`);
}
function delResult(id){conf2('Delete Result','Delete this result record?',()=>{sv('results',ld('results').filter(x=>x.id!==id));renderResults();toast('Result deleted');});}

// ═══════════════════════════════════════
// BILLING CRUD
// ═══════════════════════════════════════
function renderBilling(){
  const q=gV('bSrch').toLowerCase();
  let bills=ld('billing');if(CU.role==='doctor') bills=bills.filter(b=>b.doctorId===CU.id);
  const f=bills.filter(b=>!q||(b.id+b.patient+b.doctor).toLowerCase().includes(q)).sort((a,b)=>b.id.localeCompare(a.id));
  const tR=f.reduce((s,b)=>s+Number(b.total||0),0),tP=f.reduce((s,b)=>s+Number(b.paid||0),0);
  document.getElementById('bTotR').textContent='₪'+tR.toLocaleString();
  document.getElementById('bTotP').textContent='₪'+tP.toLocaleString();
  document.getElementById('bTotB').textContent='₪'+(tR-tP).toLocaleString();
  document.getElementById('bInvC').textContent=f.length;
  document.getElementById('billTbl').innerHTML=f.length?f.map(b=>{
    const bal=Number(b.total||0)-Number(b.paid||0);
    return`<tr><td class="tM">${esc(b.id)}</td><td class="tN">${esc(b.patient)}</td><td style="font-size:11px">${esc(b.doctor||'—')}</td><td class="tM">${fmtD(b.date)}</td><td class="tPr">₪${Number(b.total||0)}</td><td style="color:var(--green2);font-weight:700">₪${Number(b.paid||0)}</td><td style="color:${bal>0?'var(--red2)':'var(--green2)'};font-weight:700">₪${bal}</td><td><span class="badge ${bal<=0?'bG':Number(b.paid||0)>0?'bGd':'bR'}">${bal<=0?'Paid':Number(b.paid||0)>0?'Partial':'Unpaid'}</span></td><td><button class="ab abE" onclick="editBill('${esc(b.id)}')">✏</button><button class="ab abD" onclick="delBill('${esc(b.id)}')">🗑</button></td></tr>`;}).join('')
  :'<tr><td colspan="9" class="empty"><span class="eIco">💰</span><p>No invoices</p></td></tr>';
}
function populateBillModal(){
  let pats=ld('patients');if(CU.role==='doctor') pats=pats.filter(p=>p.ownerId===CU.id);
  document.getElementById('bmPat').innerHTML='<option value="">Select patient...</option>'+pats.map(p=>`<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
  const docs=ld('users').filter(u=>u.role==='doctor'&&u.status==='Active');
  const ds=document.getElementById('bmDoc');ds.innerHTML='<option value="">Select doctor...</option>'+docs.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
  if(CU.role==='doctor'){sV('bmDoc',CU.name);ds.disabled=true;}else ds.disabled=false;
}
function openAddBilling(){
  document.getElementById('bmTitle').textContent='💰 New Invoice';document.getElementById('bmIdH').value='';
  sV('bmId',genID('INV',ld('billing')));sV('bmDate',tod());sV('bmTotal','');sV('bmPaid','');sV('bmNotes','');
  populateBillModal();openM('billModal');
}
function editBill(id){
  const b=ld('billing').find(x=>x.id===id);if(!b)return;
  document.getElementById('bmTitle').textContent='✏ Edit Invoice';document.getElementById('bmIdH').value=id;
  sV('bmId',b.id);sV('bmDate',b.date);sV('bmTotal',b.total);sV('bmPaid',b.paid);sV('bmNotes',b.notes);
  populateBillModal();sV('bmPat',b.patient);sV('bmDoc',b.doctor);openM('billModal');
}
function saveBill(){
  const pat=gV('bmPat');if(!pat){toast('Select a patient','error');return;}
  const bills=ld('billing'),idH=gV('bmIdH'),doc=gV('bmDoc');
  const docU=ld('users').find(u=>u.name===doc),patO=ld('patients').find(p=>p.name===pat);
  const resolvedDocId2 = docU ? docU.id : (CU.role==='doctor'||CU.role==='lab') ? CU.id : '';
  const obj={id:gV('bmId')||genID('INV',bills),date:gV('bmDate')||tod(),patient:pat,patientId:patO?.id||'',doctorId:resolvedDocId2,doctor:doc,total:parseFloat(gV('bmTotal'))||0,paid:parseFloat(gV('bmPaid'))||0,notes:gV('bmNotes')};
  if(idH){const i=bills.findIndex(x=>x.id===idH);if(i>=0)bills[i]=obj;else bills.push(obj);}else bills.push(obj);
  sv('billing',bills);closeM('billModal');renderBilling();toast(idH?'✅ Invoice updated':'✅ Invoice created');
}
function delBill(id){conf2('Delete Invoice','Delete this invoice?',()=>{sv('billing',ld('billing').filter(x=>x.id!==id));renderBilling();toast('Invoice deleted');});}

// ═══════════════════════════════════════
// REPORT
// ═══════════════════════════════════════
function populateRepSel(){
  let pats=ld('patients');if(CU.role==='doctor') pats=pats.filter(p=>p.ownerId===CU.id);
  document.getElementById('rptPatSel').innerHTML='<option value="">— Select Patient —</option>'+pats.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)})</option>`).join('');
  document.getElementById('rptOrdSel').innerHTML='<option value="">— Select Order —</option>';
  document.getElementById('rptDate').textContent='Date: '+new Date().toLocaleDateString('en-GB');
  document.getElementById('rptBody').innerHTML='<tr><td colspan="7" style="text-align:center;color:#94A3B8;padding:16px">Select patient and order above</td></tr>';
}
function loadRepOrders(){
  const pid=gV('rptPatSel');if(!pid)return;
  const p=ld('patients').find(x=>x.id===pid);
  const ords=ld('orders').filter(o=>o.patientId===pid||o.patient===(p?.name||''));
  document.getElementById('rptOrdSel').innerHTML='<option value="">— Select Order —</option>'+ords.map(o=>`<option value="${esc(o.id)}">${esc(o.id)} (${fmtD(o.date)})</option>`).join('');
  document.getElementById('rptName').textContent=p?.name||'—';
  document.getElementById('rptPID').textContent=pid;
  document.getElementById('rptGA').textContent=(p?.gender||'—')+' / Age '+(p?.age||'—');
}
function loadRepResults(){
  const oid=gV('rptOrdSel');if(!oid)return;
  const ord=ld('orders').find(o=>o.id===oid);if(!ord)return;
  document.getElementById('rptDoctor').textContent=ord.doctor||'—';
  document.getElementById('rptOID').textContent=oid;
  document.getElementById('rptTDate').textContent=fmtD(ord.date);
  const res=ld('results').filter(r=>r.orderId===oid);
  document.getElementById('rptBody').innerHTML=res.length?res.map((r,i)=>`
    <tr><td style="text-align:center;font-weight:700">${i+1}</td><td style="font-weight:600">${esc(r.testName)}</td>
    <td style="font-size:11px;color:var(--gray5)">${esc(r.paramName||'—')}</td>
    <td style="font-weight:700;color:${r.flag==='H'?'#B71C1C':r.flag==='L'?'#1565C0':'#1B5E20'}">${esc(r.value)}</td>
    <td>${esc(r.unit||'—')}</td><td>${esc(r.norm||'—')}</td>
    <td style="text-align:center">${flagEl(r.flag)}</td></tr>`).join('')
  :'<tr><td colspan="7" style="text-align:center;padding:16px;color:#94A3B8">No results entered for this order</td></tr>';
}

// ═══════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════
function exportExcel(){
  if(CU.role!=='admin'){toast('Admin only','error');return;}
  try{
    const wb=XLSX.utils.book_new();
    // Patients
    const pats=ld('patients').map(p=>({'Patient ID':p.id,'Full Name':p.name,'DOB':p.dob,'Age':p.age,'Gender':p.gender,'Blood Type':p.blood,'Phone':p.phone,'Email':p.email,'Address':p.address,'Insurance':p.ins,'Type':p.type||'regular','Added By':p.ownerName,'Reg. Date':p.date,'Notes':p.notes}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(pats),'Patients');
    // Users
    const users=ld('users').map(u=>({'User ID':u.id,'Username':u.username,'Role':u.role,'Full Name':u.name,'Specialty':u.specialty,'Department':u.dept,'Lab Dept':u.labDept,'Phone':u.phone,'Email':u.email,'Status':u.status,'Created':u.created}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(users),'Users');
    // Tests
    const tests=ld('tests').map(t=>({'Test ID':t.id,'Name':t.name,'Department':t.dept,'Sample':t.sample,'Price(₪)':t.price,'TAT(h)':t.tat,'Unit':t.unit,'Normal Range':t.norm,'Normal Male':t.normM,'Normal Female':t.normF,'Method':t.method,'Status':t.status,'Params Count':t.params?.length||0,'Notes':t.notes}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(tests),'Tests');
    // Orders
    const ords=ld('orders').map(o=>({'Order ID':o.id,'Date':o.date,'Patient':o.patient,'Patient ID':o.patientId,'Doctor':o.doctor,'Doctor ID':o.doctorId,'Tests':getTests(o).join(' | '),'Priority':o.priority,'Status':o.status,'Shift ID':o.shiftId,'Notes':o.notes}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ords),'Orders');
    // Results
    const res=ld('results').map(r=>({'Result ID':r.id,'Date':r.date,'Order ID':r.orderId,'Patient':r.patient,'Test ID':r.testId,'Test Name':r.testName,'Parameter':r.paramName,'Value':r.value,'Unit':r.unit,'Normal Range':r.norm,'Flag':r.flag,'Technician':r.tech,'Comment':r.comment}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(res),'Results');
    // Billing
    const bill=ld('billing').map(b=>({'Invoice ID':b.id,'Date':b.date,'Patient':b.patient,'Doctor':b.doctor,'Total(₪)':b.total,'Paid(₪)':b.paid,'Balance(₪)':Number(b.total||0)-Number(b.paid||0),'Notes':b.notes}));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(bill),'Billing');
    // Shifts
    const shifts=ld('shifts').concat(ldOne('curShift')?[ldOne('curShift')]:[]);
    const shData=shifts.map(s=>({'Shift ID':s.id,'Lab User':s.labUser,'Name':s.labName,'Start Date':s.startDate,'Start Time':s.startTime,'Orders Processed':s.ordersProcessed,'Results Entered':s.resultsEntered,'Patients Added':s.patientsAdded}));
    if(shData.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(shData),'Shifts');
    const fname='MedLabLIS_Export_'+tod()+'.xlsx';
    XLSX.writeFile(wb,fname);
    toast('✅ Exported: '+fname);
  }catch(e){toast('Export error: '+e.message,'error');}
}

// ═══════════════════════════════════════
// EXCEL IMPORT
// ═══════════════════════════════════════
function importExcel(){
  if(CU.role!=='admin'){toast('Admin only','error');return;}
  const inp=document.createElement('input');inp.type='file';inp.accept='.xlsx,.xls';
  inp.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:'binary'});let imported=0;
        if(wb.SheetNames.includes('Patients')){
          const rows=XLSX.utils.sheet_to_json(wb.Sheets['Patients']);
          const valid=rows.filter(r=>r['Patient ID']&&r['Full Name']);
          if(valid.length){const mapped=valid.map(r=>({id:String(r['Patient ID']||''),name:String(r['Full Name']||''),dob:String(r['DOB']||''),age:r['Age']||'',gender:String(r['Gender']||''),blood:String(r['Blood Type']||''),phone:String(r['Phone']||''),email:String(r['Email']||''),address:String(r['Address']||''),ins:String(r['Insurance']||''),type:String(r['Type']||'regular'),ownerName:String(r['Added By']||''),date:String(r['Reg. Date']||tod()),notes:String(r['Notes']||''),ownerId:'',ownerRole:''}));const ex=ld('patients');mapped.forEach(row=>{const i=ex.findIndex(x=>x.id===row.id);if(i>=0)ex[i]=row;else ex.push(row);});sv('patients',ex);imported+=mapped.length;}
        }
        if(wb.SheetNames.includes('Orders')){
          const rows=XLSX.utils.sheet_to_json(wb.Sheets['Orders']);
          const valid=rows.filter(r=>r['Order ID']&&r['Patient']);
          if(valid.length){const mapped=valid.map(r=>({id:String(r['Order ID']||''),date:String(r['Date']||tod()),patient:String(r['Patient']||''),patientId:String(r['Patient ID']||''),doctor:String(r['Doctor']||''),doctorId:String(r['Doctor ID']||''),tests:(String(r['Tests']||'')).split(' | ').filter(Boolean),priority:String(r['Priority']||'Routine'),status:String(r['Status']||'Pending'),shiftId:String(r['Shift ID']||''),notes:String(r['Notes']||'')}));const ex=ld('orders');mapped.forEach(row=>{const i=ex.findIndex(x=>x.id===row.id);if(i>=0)ex[i]=row;else ex.push(row);});sv('orders',ex);imported+=mapped.length;}
        }
        if(wb.SheetNames.includes('Results')){
          const rows=XLSX.utils.sheet_to_json(wb.Sheets['Results']);
          const valid=rows.filter(r=>r['Result ID']&&r['Test Name']);
          if(valid.length){const mapped=valid.map(r=>({id:String(r['Result ID']||''),date:String(r['Date']||tod()),orderId:String(r['Order ID']||''),patient:String(r['Patient']||''),testId:String(r['Test ID']||''),testName:String(r['Test Name']||''),paramName:String(r['Parameter']||''),value:String(r['Value']||''),unit:String(r['Unit']||''),norm:String(r['Normal Range']||''),flag:String(r['Flag']||'N'),tech:String(r['Technician']||''),comment:String(r['Comment']||'')}));const ex=ld('results');mapped.forEach(row=>{const i=ex.findIndex(x=>x.id===row.id);if(i>=0)ex[i]=row;else ex.push(row);});sv('results',ex);imported+=mapped.length;}
        }
        if(wb.SheetNames.includes('Billing')){
          const rows=XLSX.utils.sheet_to_json(wb.Sheets['Billing']);
          const valid=rows.filter(r=>r['Invoice ID']&&r['Patient']);
          if(valid.length){const mapped=valid.map(r=>({id:String(r['Invoice ID']||''),date:String(r['Date']||tod()),patient:String(r['Patient']||''),doctor:String(r['Doctor']||''),total:Number(r['Total(₪)'])||0,paid:Number(r['Paid(₪)'])||0,notes:String(r['Notes']||'')}));const ex=ld('billing');mapped.forEach(row=>{const i=ex.findIndex(x=>x.id===row.id);if(i>=0)ex[i]=row;else ex.push(row);});sv('billing',ex);imported+=mapped.length;}
        }
        toast(`✅ Import complete — ${imported} records merged`);
        renderAdmDash();
      }catch(err){toast('Import failed: '+err.message,'error');}
    };
    reader.readAsBinaryString(file);
  };
  inp.click();
}

// ═══════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════
// Start the app — load Firebase data first, then init
fbInit();

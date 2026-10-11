import {
    signup,
    login,
    logout,
    listenToAuth
} from "./auth.js";
const $ = (id) => document.getElementById(id);
const STORAGE_USERS = "moneta_demo_users_v1";
const SESSION_KEY = "moneta_demo_session_v1";
const DATA_PREFIX = "moneta_demo_transactions_v1";
const expenseCategories = ["Food & Dining","Transport","Shopping","Bills & Utilities","Health","Entertainment","Education","Other"];
const incomeCategories = ["Salary","Freelance","Business","Investments","Gift","Other"];
const palette = ["#39956b","#ed999c","#7e8bd5","#e8b35d","#70b9c0","#b28bd0","#8a9b90","#d57f62"];
let authMode = "login", currentUser = null, transactions = [], toastTimer = null;
let charts = {};
const today = new Date();
const localISODate = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset()*60000);
  return d.toISOString().slice(0,10);
};
const currency = (value) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits: value % 1 === 0 ? 0 : 2}).format(value);
const formatDate = (value) => new Date(value+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getUsers = () => { try{return JSON.parse(localStorage.getItem(STORAGE_USERS)||"[]")}catch{return []} };
const saveUsers = (users) => localStorage.setItem(STORAGE_USERS,JSON.stringify(users));
const dataKey = () => DATA_PREFIX + "_" + currentUser.email.toLowerCase();
function showToast(message){
  $("toast").textContent=message;$("toast").classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2500);
}
function setAuthMode(mode){
  authMode=mode;
  $("authTitle").textContent=mode==="login"?"Welcome back":"Create your account";
  $("authSubtitle").textContent=mode==="login"?"Sign in to see your financial overview.":"Start building a clearer picture of your money.";
  $("authSubmit").textContent=mode==="login"?"Sign in":"Create account";
  $("switchPrompt").textContent=mode==="login"?"New to Moneta?":"Already have an account?";
  $("switchAuth").textContent=mode==="login"?"Create an account":"Sign in";
  $("authName").classList.toggle("hidden",mode==="login");
  $("nameLabel").classList.toggle("hidden",mode==="login");
  $("authName").required=mode==="signup";
  $("authPassword").autocomplete=mode==="login"?"current-password":"new-password";
  $("authError").textContent="";
}
$("switchAuth").addEventListener("click",()=>setAuthMode(authMode==="login"?"signup":"login"));

$("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("authEmail").value.trim().toLowerCase();
    const password = $("authPassword").value;

    $("authSubmit").disabled = true;
    $("authError").textContent = "";

    try {
        let result;

        if (authMode === "signup") {
            const name = $("authName").value.trim();

            if (!name) {
                $("authError").textContent = "Please enter your name.";
                return;
            }

            result = await signup(name, email, password);
        } else {
            result = await login(email, password);
        }

        if (!result.success) {
            $("authError").textContent = result.message;
            return;
        }

        const firebaseUser = result.user;

        startApp({
            name: firebaseUser.displayName || firebaseUser.email,
            email: firebaseUser.email,
            uid: firebaseUser.uid
        });
    } catch (error) {
        $("authError").textContent =
            "Something went wrong. Please try again.";
        console.error(error);
    } finally {
        $("authSubmit").disabled = false;
    }
});

function startApp(user){
  currentUser=user;
  $("authScreen").classList.add("hidden");$("app").classList.remove("hidden");
  $("avatar").textContent=(user.name||user.email).trim().charAt(0).toUpperCase();
  const hour=new Date().getHours();
  $("greeting").textContent=`Good ${hour<12?"morning":hour<17?"afternoon":"evening"}, ${(user.name||"there").split(" ")[0]}`;
  $("todayLabel").textContent=today.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
  try{transactions=JSON.parse(localStorage.getItem(dataKey())||"[]")}catch{transactions=[]}
  renderAll();resizeCharts();
}

async function handleLogout() {
    const result = await logout();

    if (!result.success) {
        showToast(result.message || "Logout failed.");
        return;
    }

    currentUser = null;
    transactions = [];

    $("app").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    $("authForm").reset();
    setAuthMode("login");
}

$("logoutBtn").addEventListener("click", handleLogout);
$("logoutBtn").addEventListener("click",logout);
function saveTransactions(){localStorage.setItem(dataKey(),JSON.stringify(transactions))}
function totals(){
  const income=transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return {income,expense,balance:income-expense,rate:income?Math.round((income-expense)/income*100):0};
}
function sumByCategory(type){
  const sums={};
  transactions.filter(t=>t.type===type).forEach(t=>sums[t.category]=(sums[t.category]||0)+t.amount);
  return Object.entries(sums).sort((a,b)=>b[1]-a[1]);
}
function renderAll(){
  const t=totals();
  $("totalBalance").textContent=currency(t.balance);$("totalIncome").textContent=currency(t.income);
  $("totalExpense").textContent=currency(t.expense);$("savingsRate").textContent=`${t.rate}%`;
  $("netFlow").textContent=`${currency(t.balance)} net`;
  $("donutExpenseTotal").textContent=currency(t.expense);$("donutIncomeTotal").textContent=currency(t.income);
  renderTransactions();renderCategoriesFilter();renderCharts();
}
function transactionSymbol(t){
  const icons={"Food & Dining":"⌁","Transport":"↗","Shopping":"◇","Bills & Utilities":"▤","Health":"＋","Entertainment":"♫","Education":"▣","Salary":"▤","Freelance":"✳","Business":"▥","Investments":"◈","Gift":"♡","Other":"•"};
  return icons[t.category]||"•";
}
function transactionMarkup(t, compact=false){
  const income=t.type==="income";
  return `<div class="transaction-item"><div class="transaction-main"><div class="transaction-symbol ${income?"income-symbol":"expense-symbol"}">${transactionSymbol(t)}</div><div style="min-width:0"><div class="transaction-name">${escapeHTML(t.title)}</div><div class="transaction-meta">${escapeHTML(t.category)} · ${formatDate(t.date)}</div></div></div><div class="transaction-amount ${income?"income-amount":"expense-amount"}">${income?"+":"−"}${currency(t.amount)}${compact?"":`<small>${income?"Income":"Expense"}</small>`}</div></div>`;
}
function renderTransactions(){
  const sorted=[...transactions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  $("recentTransactions").innerHTML=sorted.slice(0,5).map(t=>transactionMarkup(t,true)).join("")||`<div class="empty-state"><span class="empty-icon">↕</span><strong>No activity yet</strong><p>Add your first income or expense to get started.</p></div>`;
  const query=($("searchInput")?.value||"").toLowerCase().trim(), type=$("typeFilter")?.value||"all", category=$("categoryFilter")?.value||"all";
  const filtered=sorted.filter(t=>(type==="all"||t.type===type)&&(category==="all"||t.category===category)&&`${t.title} ${t.category} ${t.note||""}`.toLowerCase().includes(query));
  $("transactionRows").innerHTML=filtered.map(t=>`<tr><td>${escapeHTML(t.title)}</td><td>${escapeHTML(t.category)}</td><td>${formatDate(t.date)}</td><td><span class="type-badge ${t.type}">${t.type==="income"?"Income":"Expense"}</span></td><td class="amount-cell">${t.type==="income"?"+":"−"}${currency(t.amount)}</td><td><button class="delete-btn" data-delete="${t.id}" title="Delete transaction" aria-label="Delete ${escapeHTML(t.title)}">×</button></td></tr>`).join("");
  $("emptyTransactions").classList.toggle("hidden",filtered.length>0);
}
function renderCategoriesFilter(){
  const current=$("categoryFilter").value||"all";
  const categories=[...new Set([...expenseCategories,...incomeCategories,...transactions.map(t=>t.category)])].sort();
  $("categoryFilter").innerHTML='<option value="all">All categories</option>'+categories.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
  $("categoryFilter").value=categories.includes(current)?current:"all";
  $("categoryFilter").onchange=renderTransactions;
}
function updateCategoryOptions(){
  const type=$("transactionType").value, options=type==="income"?incomeCategories:expenseCategories;
  $("transactionCategory").innerHTML=options.map(c=>`<option>${escapeHTML(c)}</option>`).join("");
}
function openModal(){
  $("transactionForm").reset();$("transactionError").textContent="";
  $("transactionType").value="expense";document.querySelectorAll(".type-option").forEach(b=>b.classList.toggle("selected",b.dataset.type==="expense"));
  $("transactionDate").value=localISODate(new Date());updateCategoryOptions();
  $("transactionModal").classList.remove("hidden");$("transactionTitle").focus();
}
function closeModal(){$("transactionModal").classList.add("hidden")}
$("addTopBtn").addEventListener("click",openModal);$("addTransactionsBtn").addEventListener("click",openModal);
$("closeModal").addEventListener("click",closeModal);$("cancelModal").addEventListener("click",closeModal);
$("transactionModal").addEventListener("click",e=>{if(e.target===$("transactionModal"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
document.querySelectorAll(".type-option").forEach(button=>button.addEventListener("click",()=>{
  $("transactionType").value=button.dataset.type;
  document.querySelectorAll(".type-option").forEach(b=>b.classList.toggle("selected",b===button));updateCategoryOptions();
}));
$("transactionForm").addEventListener("submit",e=>{
  e.preventDefault();
  const title=$("transactionTitle").value.trim(), amount=Number($("transactionAmount").value);
  if(!title||!Number.isFinite(amount)||amount<=0){$("transactionError").textContent="Enter a name and an amount greater than zero.";return}
  transactions.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),title,amount,category:$("transactionCategory").value,date:$("transactionDate").value,type:$("transactionType").value,note:$("transactionNote").value.trim(),createdAt:Date.now()});
  saveTransactions();renderAll();closeModal();showToast("Transaction saved successfully.");
});
$("transactionRows").addEventListener("click",e=>{
  const button=e.target.closest("[data-delete]");if(!button)return;
  const transaction=transactions.find(t=>t.id===button.dataset.delete);
  if(!transaction)return;
  if(confirm(`Delete "${transaction.title}"?`)){transactions=transactions.filter(t=>t.id!==button.dataset.delete);saveTransactions();renderAll();showToast("Transaction deleted.")}
});
$("searchInput").addEventListener("input",renderTransactions);$("typeFilter").addEventListener("change",renderTransactions);
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>switchView(button.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(button=>button.addEventListener("click",()=>switchView(button.dataset.goto)));
function switchView(view){
  ["overview","transactions","analytics"].forEach(v=>$(v+"View").classList.toggle("hidden",v!==view));
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("pageName").textContent=view==="overview"?"Overview":view==="transactions"?"Transactions":"Analytics";
  if(view==="transactions")renderTransactions();if(view==="analytics")renderCharts();
}
function setupCanvas(canvas){
  const rect=canvas.getBoundingClientRect(), dpr=Math.max(1,window.devicePixelRatio||1);
  canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w:rect.width,h:rect.height};
}
function drawDonut(canvasId, entries){
  const canvas=$(canvasId);if(!canvas||canvas.offsetParent===null)return;
  const {ctx,w,h}=setupCanvas(canvas);ctx.clearRect(0,0,w,h);
  const total=entries.reduce((s,e)=>s+e[1],0),cx=w/2,cy=h/2,r=Math.min(w,h)*.38,thickness=Math.min(23,r*.38);
  if(!total){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle="#edf1ee";ctx.lineWidth=thickness;ctx.stroke();return}
  let start=-Math.PI/2;
  entries.forEach((entry,i)=>{const angle=entry[1]/total*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,start+angle+.012);ctx.strokeStyle=palette[i%palette.length];ctx.lineWidth=thickness;ctx.lineCap="butt";ctx.stroke();start+=angle});
}
function drawLegend(id,entries){
  const node=$(id);if(!node)return;
  const total=entries.reduce((s,e)=>s+e[1],0);
  node.innerHTML=entries.slice(0,6).map((e,i)=>`<div class="legend-item"><span class="legend-swatch" style="background:${palette[i%palette.length]}"></span><span class="legend-name" title="${escapeHTML(e[0])}">${escapeHTML(e[0])}</span><span class="legend-value">${total?Math.round(e[1]/total*100):0}%</span></div>`).join("")||`<div class="muted">No data yet</div>`;
}
function drawBars(canvasId){
  const canvas=$(canvasId);if(!canvas||canvas.offsetParent===null)return;
  const {ctx,w,h}=setupCanvas(canvas);ctx.clearRect(0,0,w,h);
  const t=totals(), max=Math.max(t.income,t.expense,1), left=36,right=12,top=13,bottom=31,plotH=h-top-bottom,plotW=w-left-right;
  ctx.font='10px "DM Sans", sans-serif';ctx.textBaseline="middle";
  for(let i=0;i<4;i++){const y=top+plotH*i/3;ctx.strokeStyle="#edf1ee";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle="#9aa49f";ctx.textAlign="left";ctx.fillText(i===0?currency(max):i===1?currency(max*2/3):i===2?currency(max/3):"₹0",0,y)}
  const groupW=plotW/2,barW=Math.min(48,groupW*.28);
  [{label:"Income",value:t.income,color:"#39956b",offset:-barW/2-3},{label:"Expenses",value:t.expense,color:"#ed999c",offset:barW/2+3}].forEach((b,i)=>{
    const x=left+groupW*(i+.5)+b.offset,y=top+plotH-(b.value/max)*plotH;
    ctx.fillStyle=b.color;roundRect(ctx,x,y,barW,Math.max(0,top+plotH-y),5);ctx.fill();
    ctx.fillStyle="#69776e";ctx.textAlign="center";ctx.fillText(b.label,left+groupW*(i+.5),h-12);
  });
}
function roundRect(ctx,x,y,w,h,r){if(h<=0)return;ctx.beginPath();ctx.roundRect(x,y,w,h,[Math.min(r,w/2,h/2)]);}
function renderCharts(){
  const expense=sumByCategory("expense"),income=sumByCategory("income");
  drawDonut("expenseChart",expense);drawLegend("expenseLegend",expense);
  drawDonut("incomeChart",income);drawLegend("incomeLegend",income);
  drawBars("cashflowChart");
  drawDonut("analyticsExpenseChart",expense);drawLegend("analyticsExpenseLegend",expense);
  drawDonut("analyticsIncomeChart",income);drawLegend("analyticsIncomeLegend",income);
  drawBars("analyticsCashflowChart");
}
let resizeTimer;
function resizeCharts(){clearTimeout(resizeTimer);resizeTimer=setTimeout(renderCharts,100)}
window.addEventListener("resize",resizeCharts);
(function init(){
  setAuthMode("login");
  try{const session=JSON.parse(localStorage.getItem(SESSION_KEY)||"null");if(session?.email){const user=getUsers().find(u=>u.email===session.email);if(user){startApp(user);return}localStorage.removeItem(SESSION_KEY)}}catch{}
})();

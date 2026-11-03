const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso=d=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const fmtn=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.'),R=n=>'Rp'+fmtn(n),num=el=>+el.value.replace(/\./g,'')||0;
// Format nominal otomatis: titik ribuan, hanya angka
document.addEventListener('input',e=>{if(e.target.classList.contains('rp')){let v=e.target.value.replace(/\D/g,'').replace(/^0+/,'');e.target.value=v.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}});
const SCHEMA=`CREATE TABLE accounts(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,initial_balance REAL DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,type TEXT CHECK(type IN('income','expense'))NOT NULL,icon TEXT DEFAULT '📁',color_code TEXT DEFAULT '#3B82F6');
CREATE TABLE budgets(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,category_id INTEGER NULL,period_type TEXT CHECK(period_type IN('daily','weekly','monthly','custom'))NOT NULL,amount_limit REAL NOT NULL,start_date DATE NOT NULL,end_date DATE NOT NULL,is_active INTEGER DEFAULT 1,auto_renew INTEGER DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,to_account_id INTEGER,category_id INTEGER,type TEXT CHECK(type IN('income','expense','transfer'))NOT NULL,amount REAL NOT NULL,transaction_date DATE NOT NULL,note TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`;
let db,SQL;
const idb=()=>new Promise((r,j)=>{const o=indexedDB.open('akt',1);o.onupgradeneeded=()=>o.result.createObjectStore('s');o.onsuccess=()=>r(o.result);o.onerror=j});
const idbGet=async()=>{const d=await idb();return new Promise(r=>{const q=d.transaction('s').objectStore('s').get('db');q.onsuccess=()=>r(q.result)})};
const idbSet=async v=>{const d=await idb();return new Promise(r=>{const t=d.transaction('s','readwrite');t.objectStore('s').put(v,'db');t.oncomplete=r})};
const save=()=>idbSet(db.export());
const q=(s,p=[])=>{const st=db.prepare(s);st.bind(p);const r=[];while(st.step())r.push(st.getAsObject());st.free();return r};
const run=(s,p=[])=>{db.run(s,p);save()};
function seed(){db.run(SCHEMA);db.run("INSERT INTO accounts(name,initial_balance)VALUES('Tunai',0)");
[['Gaji','income','💼','#16a34a'],['Bonus','income','🎁','#22c55e'],['Investasi','income','📈','#0ea5e9'],['Makan & Minum','expense','🍜','#f97316'],['Belanja','expense','🛒','#a855f7'],['Listrik & Air','expense','💡','#eab308'],['Transport','expense','🚌','#3b82f6'],['Hiburan','expense','🎬','#ec4899'],['Cicilan','expense','🏦','#ef4444']].forEach(c=>db.run('INSERT INTO categories(name,type,icon,color_code)VALUES(?,?,?,?)',c))}
// ===== PIN =====
const H=async p=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(localStorage.salt+p)))].map(x=>x.toString(16).padStart(2,'0')).join('');
let fails=0,until=0;const err=m=>{$('#le').textContent=m};
function lock(){const s=!localStorage.ph;$('#lk').hidden=false;$('#app').hidden=true;$('main').innerHTML='';closeM();$('#lt').textContent=s?'Buat PIN (4–6 angka)':'Masukkan PIN';$('#p2').hidden=!s;$('#lb').textContent=s?'Simpan PIN':'Masuk';$('#p1').value=$('#p2').value='';err('')}
function openApp(){$('#lk').hidden=true;$('#app').hidden=false;go('dash')}
$('#lb').onclick=async()=>{const p=$('#p1').value;if(!/^\d{4,6}$/.test(p))return err('PIN harus 4–6 angka');
if(!localStorage.ph){if(p!=$('#p2').value)return err('Konfirmasi PIN tidak sama');localStorage.salt=crypto.randomUUID();localStorage.ph=await H(p);openApp()}
else{if(Date.now()<until)return err('Terlalu banyak percobaan, tunggu 30 detik');if(await H(p)==localStorage.ph){fails=0;openApp()}else{if(++fails>=5){until=Date.now()+3e4;fails=0}err('PIN salah');$('#p1').value=''}}};
let hid=0;document.addEventListener('visibilitychange',()=>{if(document.hidden)hid=Date.now();else if(hid&&Date.now()-hid>6e4&&!$('#app').hidden)lock()});
// ===== Util =====
function modal(h){$('#m').innerHTML='<div class="box">'+h+'</div>';$('#m').classList.add('on')}
const closeM=()=>$('#m').classList.remove('on');
const opt=(rows,sel,all)=>(all!=null?`<option value="">${all}</option>`:'')+rows.map(r=>`<option value="${r.id}" ${r.id==sel?'selected':''}>${E(r.icon||'')} ${E(r.name)}</option>`).join('');
const bal=()=>q(`SELECT a.id,a.name,a.initial_balance+COALESCE((SELECT SUM(CASE WHEN type='income' THEN amount ELSE -amount END) FROM transactions WHERE account_id=a.id AND type IN('income','expense')),0)-COALESCE((SELECT SUM(amount) FROM transactions WHERE type='transfer' AND account_id=a.id),0)+COALESCE((SELECT SUM(amount) FROM transactions WHERE type='transfer' AND to_account_id=a.id),0) AS b FROM accounts a`);
const sumM=(m,t)=>q("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type=? AND substr(transaction_date,1,7)=?",[t,m])[0].s;
// ===== Budget engine =====
function win(b){let s=new Date(b.start_date),e=new Date(b.end_date);const t=new Date(iso(new Date()));
if(b.auto_renew)while(e<t){if(b.period_type=='monthly'){s=new Date(s.getFullYear(),s.getMonth()+1,1);e=new Date(s.getFullYear(),s.getMonth()+1,0)}else{const n=(e-s)/864e5+1;s=new Date(+s+n*864e5);e=new Date(+e+n*864e5)}}
return[iso(s),iso(e)]}
function bstat(b){const[s,e]=win(b);const sp=q(`SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE type='expense' AND transaction_date BETWEEN ? AND ?`+(b.category_id?' AND category_id='+(+b.category_id):''),[s,e])[0].s;
const pct=sp/b.amount_limit*100,rem=b.amount_limit-sp,today=iso(new Date());
const left=Math.max(1,Math.round((new Date(e)-new Date(today))/864e5)+1);
return{s,e,sp,pct,rem,safe:Math.max(0,rem)/left,col:pct>=100?'var(--r)':pct>=75?'var(--y)':'var(--g)',st:pct>=100?'Over budget':pct>=75?'Mendekati batas':'Aman'}}
function bcard(b,full){const x=bstat(b);return`<div class="card" ${full?`onclick="budForm(${b.id})"`:''}><div class="row" style="border:0;padding:0"><b>${E(b.name)}</b><span class="m">${b.cn?E(b.cn):'Semua kategori'} · ${b.period_type}</span></div>
<div class="bar"><i style="width:${Math.min(100,x.pct)}%;background:${x.col}"></i></div>
<div class="row" style="border:0;padding:0"><span>${R(x.sp)} / ${R(b.amount_limit)}</span><b style="color:${x.col}">${x.pct.toFixed(0)}%</b></div>
<div class="m">${x.st} · Sisa ${R(x.rem)} · Aman/hari ${R(x.safe)}<br>${x.s} s/d ${x.e}${b.auto_renew?' · Auto-renew':''}${b.is_active?'':' · Nonaktif'}</div></div>`}
const budgets=()=>q('SELECT b.*,c.name cn FROM budgets b LEFT JOIN categories c ON c.id=b.category_id ORDER BY is_active DESC,b.id DESC');
// ===== Views =====
let view='dash',F={m:iso(new Date()).slice(0,7),t:'',a:'',c:''},charts=[];const main=$('main');
const V={
dash(){const m=iso(new Date()).slice(0,7),B=bal(),tot=B.reduce((s,a)=>s+a.b,0);
main.innerHTML=`<div class="card full"><h2>Total Saldo</h2><div class="big">${R(tot)}</div><div class="g2" style="margin-top:10px"><div><span class="m">Pemasukan bulan ini</span><br><b class="inc">${R(sumM(m,'income'))}</b></div><div><span class="m">Pengeluaran bulan ini</span><br><b class="exp">${R(sumM(m,'expense'))}</b></div></div></div>
<div class="card"><h2>Akun</h2>${B.map(a=>`<div class="row"><span>${E(a.name)}</span><b>${R(a.b)}</b></div>`).join('')}</div>
<h2 class="full" style="font-size:14px;color:var(--m);margin:4px 4px 0">Budget Aktif</h2>${budgets().filter(b=>b.is_active).map(b=>bcard(b)).join('')||'<div class="card m full">Belum ada budget.</div>'}`},
tx(){const A=q('SELECT * FROM accounts'),C=q('SELECT * FROM categories');
let w=["substr(transaction_date,1,7)=?"],p=[F.m];if(F.t){w.push('t.type=?');p.push(F.t)}if(F.a){w.push('(account_id=? OR to_account_id=?)');p.push(F.a,F.a)}if(F.c){w.push('category_id=?');p.push(F.c)}
const L=q(`SELECT t.*,a.name an,b.name bn,c.name cn,c.icon ci FROM transactions t JOIN accounts a ON a.id=account_id LEFT JOIN accounts b ON b.id=to_account_id LEFT JOIN categories c ON c.id=category_id WHERE ${w.join(' AND ')} ORDER BY transaction_date DESC,t.id DESC`,p);
main.innerHTML=`<div class="card full"><div class="g2 filt"><input type="month" id="fm" value="${F.m}"><select id="ft"><option value="">Semua jenis</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option><option value="transfer">Transfer</option></select><select id="fa">${opt(A,F.a,'Semua akun')}</select><select id="fc">${opt(C,F.c,'Semua kategori')}</select></div></div>
<div class="card full">${L.map(t=>`<div class="row" onclick="txForm(${t.id})"><div><b>${t.type=='transfer'?'🔁 '+E(t.an)+' → '+E(t.bn):(t.ci||'')+' '+E(t.cn||'-')}</b><div class="m">${t.transaction_date} · ${t.type=='transfer'?'Transfer':E(t.an)}${t.note?' · '+E(t.note):''}</div></div><div style="text-align:right"><b class="${t.type=='income'?'inc':t.type=='expense'?'exp':''}">${t.type=='expense'?'-':t.type=='income'?'+':''}${R(t.amount)}</b><button class="x" onclick="event.stopPropagation();delTx(${t.id})">🗑</button></div></div>`).join('')||'<div class="m">Tidak ada transaksi.</div>'}</div>
<button class="btn fab" onclick="txForm()">＋</button>`;$('#ft').value=F.t;
[['fm','m'],['ft','t'],['fa','a'],['fc','c']].forEach(([i,k])=>$('#'+i).onchange=e=>{F[k]=e.target.value;V.tx()})},
bud(){main.innerHTML=(budgets().map(b=>bcard(b,1)).join('')||'<div class="card m full">Belum ada budget. Tekan ＋ untuk membuat.</div>')+`<button class="btn fab" onclick="budForm()">＋</button>`},
rep(){const m=F.rm||iso(new Date()).slice(0,7);F.rm=m;
const ex=q("SELECT c.name,c.color_code col,SUM(t.amount) s FROM transactions t JOIN categories c ON c.id=category_id WHERE t.type='expense' AND substr(transaction_date,1,7)=? GROUP BY c.id ORDER BY s DESC",[m]);
const ms=[];let d=new Date(m+'-01');for(let i=5;i>=0;i--){ms.push(iso(new Date(d.getFullYear(),d.getMonth()-i,1)).slice(0,7))}
main.innerHTML=`<div class="card full"><input type="month" id="rm" value="${m}"></div><div class="card"><h2>Pengeluaran per Kategori</h2>${ex.length?'<div class="ch"><canvas id="c1"></canvas></div>':'<div class="m">Belum ada data.</div>'}</div><div class="card"><h2>Pemasukan vs Pengeluaran (6 bulan)</h2><div class="ch"><canvas id="c2"></canvas></div></div>`;
$('#rm').onchange=e=>{F.rm=e.target.value;V.rep()};
const leg={position:'bottom',labels:{boxWidth:12,font:{size:11}}},base={responsive:true,maintainAspectRatio:false};
if(ex.length)charts.push(new Chart($('#c1'),{type:'doughnut',data:{labels:ex.map(x=>x.name),datasets:[{data:ex.map(x=>x.s),backgroundColor:ex.map(x=>x.col)}]},options:{...base,plugins:{legend:leg,tooltip:{callbacks:{label:c=>c.label+': '+R(c.raw)}}}}}));
const tk=v=>v>=1e6?v/1e6+'jt':v>=1e3?v/1e3+'rb':v;
charts.push(new Chart($('#c2'),{type:'bar',data:{labels:ms.map(x=>x.slice(5)+'/'+x.slice(2,4)),datasets:[{label:'Pemasukan',data:ms.map(x=>sumM(x,'income')),backgroundColor:'#16a34a'},{label:'Pengeluaran',data:ms.map(x=>sumM(x,'expense')),backgroundColor:'#dc2626'}]},options:{...base,plugins:{legend:leg,tooltip:{callbacks:{label:c=>c.dataset.label+': '+R(c.raw)}}},scales:{y:{ticks:{callback:tk,font:{size:10}}},x:{ticks:{font:{size:10}}}}}}))},
set(){const A=bal(),C=q('SELECT * FROM categories ORDER BY type,name');
main.innerHTML=`<div class="card"><h2>Akun</h2>${A.map(a=>`<div class="row"><span>${E(a.name)}</span><span>${R(a.b)} <button class="x" onclick="delAcc(${a.id})">🗑</button></span></div>`).join('')}<button class="btn sec" onclick="accForm()">＋ Tambah Akun</button></div>
<div class="card"><h2>Kategori</h2>${C.map(c=>`<div class="row"><span><span style="color:${c.color_code}">●</span> ${E(c.icon)} ${E(c.name)} <span class="m">${c.type=='income'?'masuk':'keluar'}</span></span><button class="x" onclick="delCat(${c.id})">🗑</button></div>`).join('')}<button class="btn sec" onclick="catForm()">＋ Tambah Kategori</button></div>
<div class="card"><h2>Data</h2><button class="btn" onclick="xl()">📥 Ekspor Excel (.xlsx)</button><button class="btn sec" onclick="bk()">💾 Backup (.sqlite)</button><label class="btn sec" style="display:block;text-align:center;color:var(--t)">📤 Restore (.sqlite)<input type="file" accept=".sqlite,.db" id="rs" hidden></label></div>
<div class="card"><h2>Keamanan</h2><button class="btn sec" onclick="pinForm()">🔑 Ganti PIN</button><button class="btn sec" onclick="lock()">🔒 Kunci Sekarang</button></div>
<p class="m" style="text-align:center">Data tersimpan lokal di browser ini. Lakukan backup berkala.</p>`;
$('#rs').onchange=async e=>{const f=e.target.files[0];if(!f||!confirm('Data saat ini akan diganti. Lanjutkan?'))return;try{const n=new SQL.Database(new Uint8Array(await f.arrayBuffer()));n.exec('SELECT 1 FROM transactions LIMIT 1');db=n;try{db.run('ALTER TABLE budgets ADD COLUMN auto_renew INTEGER DEFAULT 0')}catch(_){}await save();alert('Restore berhasil');go('dash')}catch(_){alert('File tidak valid')}}}};
function go(v){view=v;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v==v));charts.forEach(c=>c.destroy());charts=[];V[v]();scrollTo(0,0)}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.v));
// ===== Forms =====
function txForm(id){const t=id?q('SELECT * FROM transactions WHERE id=?',[id])[0]:{type:'expense',transaction_date:iso(new Date())},A=q('SELECT * FROM accounts');
modal(`<h3>${id?'Edit':'Tambah'} Transaksi</h3><label>Jenis<select id="xt"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option></select></label>
<label>Nominal (Rp)<input id="xa" class="rp" inputmode="numeric" placeholder="0" value="${t.amount?fmtn(t.amount):''}"></label>
<label>Akun<select id="xac">${opt(A,t.account_id)}</select></label><label id="lto">Ke Akun<select id="xto">${opt(A,t.to_account_id)}</select></label>
<label id="lc">Kategori<select id="xc"></select></label><label>Tanggal<input type="date" id="xd" value="${t.transaction_date}"></label><label>Catatan<input id="xn" value="${E(t.note)}"></label><button class="btn" id="xs">Simpan</button>`);
const sync=()=>{const ty=$('#xt').value;$('#lto').hidden=ty!='transfer';$('#lc').hidden=ty=='transfer';$('#xc').innerHTML=opt(q('SELECT * FROM categories WHERE type=?',[ty=='income'?'income':'expense']),t.category_id)};
$('#xt').value=t.type;$('#xt').onchange=sync;sync();
$('#xs').onclick=()=>{const ty=$('#xt').value,a=num($('#xa')),ac=+$('#xac').value,to=ty=='transfer'?+$('#xto').value:null,c=ty=='transfer'?null:+$('#xc').value||null;
if(a<=0)return alert('Nominal harus lebih dari 0');if(!ac)return alert('Pilih akun');if(ty=='transfer'&&(!to||to==ac))return alert('Akun tujuan harus berbeda');
const p=[ac,to,c,ty,a,$('#xd').value,$('#xn').value];
id?run('UPDATE transactions SET account_id=?,to_account_id=?,category_id=?,type=?,amount=?,transaction_date=?,note=? WHERE id=?',[...p,id]):run('INSERT INTO transactions(account_id,to_account_id,category_id,type,amount,transaction_date,note)VALUES(?,?,?,?,?,?,?)',p);closeM();go(view)}}
const delTx=id=>{if(confirm('Hapus transaksi ini?')){run('DELETE FROM transactions WHERE id=?',[id]);go(view)}};
function budForm(id){const b=id?q('SELECT * FROM budgets WHERE id=?',[id])[0]:{period_type:'monthly',is_active:1,auto_renew:1,start_date:'',end_date:''};
modal(`<h3>${id?'Edit':'Buat'} Budget</h3><label>Nama<input id="bn" value="${E(b.name)}" placeholder="mis. Makan Harian"></label>
<label>Cakupan<select id="bc"><option value="">Global (semua pengeluaran)</option>${opt(q("SELECT * FROM categories WHERE type='expense'"),b.category_id)}</select></label>
<label>Periode<select id="bp"><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option><option value="custom">Kustom</option></select></label>
<label>Batas (Rp)<input id="bl" class="rp" inputmode="numeric" value="${b.amount_limit?fmtn(b.amount_limit):''}"></label>
<div class="g2"><label>Mulai<input type="date" id="bs" value="${b.start_date}"></label><label>Sampai<input type="date" id="be" value="${b.end_date}"></label></div>
<label><input type="checkbox" id="br" style="width:auto;min-height:0" ${b.auto_renew?'checked':''}> Auto-renew</label><label><input type="checkbox" id="ba" style="width:auto;min-height:0" ${b.is_active?'checked':''}> Aktif</label>
<button class="btn" id="bsv">Simpan</button>${id?'<button class="btn red" id="bd">Hapus</button>':''}`);
$('#bp').value=b.period_type;
const fill=()=>{const p=$('#bp').value,n=new Date(),s=new Date(n);let e=new Date(n);if(p=='weekly'){const d=(n.getDay()+6)%7;s.setDate(n.getDate()-d);e=new Date(s);e.setDate(s.getDate()+6)}else if(p=='monthly'){s.setDate(1);e=new Date(n.getFullYear(),n.getMonth()+1,0)}if(p!='custom'){$('#bs').value=iso(s);$('#be').value=iso(e)}};
$('#bp').onchange=fill;if(!id)fill();
$('#bsv').onclick=()=>{const l=num($('#bl'));if(!$('#bn').value.trim()||l<=0||!$('#bs').value||!$('#be').value||$('#be').value<$('#bs').value)return alert('Lengkapi nama, batas, dan rentang tanggal yang valid');
const p=[$('#bn').value.trim(),$('#bc').value||null,$('#bp').value,l,$('#bs').value,$('#be').value,$('#ba').checked?1:0,$('#br').checked?1:0];
id?run('UPDATE budgets SET name=?,category_id=?,period_type=?,amount_limit=?,start_date=?,end_date=?,is_active=?,auto_renew=? WHERE id=?',[...p,id]):run('INSERT INTO budgets(name,category_id,period_type,amount_limit,start_date,end_date,is_active,auto_renew)VALUES(?,?,?,?,?,?,?,?)',p);closeM();go(view)};
if(id)$('#bd').onclick=()=>{if(confirm('Hapus budget?')){run('DELETE FROM budgets WHERE id=?',[id]);closeM();go(view)}}}
function accForm(){modal(`<h3>Tambah Akun</h3><label>Nama<input id="an" placeholder="mis. Bank BCA"></label><label>Saldo Awal (Rp)<input id="ab" class="rp" inputmode="numeric" placeholder="0"></label><button class="btn" id="as">Simpan</button>`);
$('#as').onclick=()=>{if(!$('#an').value.trim())return alert('Nama wajib diisi');run('INSERT INTO accounts(name,initial_balance)VALUES(?,?)',[$('#an').value.trim(),num($('#ab'))]);closeM();go('set')}}
function delAcc(id){if(q('SELECT 1 FROM transactions WHERE account_id=? OR to_account_id=? LIMIT 1',[id,id]).length)return alert('Akun masih memiliki transaksi.');if(confirm('Hapus akun?')){run('DELETE FROM accounts WHERE id=?',[id]);go('set')}}
function catForm(){modal(`<h3>Tambah Kategori</h3><label>Nama<input id="cn"></label><label>Jenis<select id="ct"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label><label>Ikon (emoji)<input id="ci" value="📁" maxlength="2"></label><label>Warna<input type="color" id="cc" value="#3b82f6"></label><button class="btn" id="cs">Simpan</button>`);
$('#cs').onclick=()=>{if(!$('#cn').value.trim())return alert('Nama wajib diisi');run('INSERT INTO categories(name,type,icon,color_code)VALUES(?,?,?,?)',[$('#cn').value.trim(),$('#ct').value,$('#ci').value,$('#cc').value]);closeM();go('set')}}
function delCat(id){if(q('SELECT 1 FROM transactions WHERE category_id=? LIMIT 1',[id]).length)return alert('Kategori masih dipakai transaksi.');if(confirm('Hapus kategori? Budget terkait ikut terhapus.')){db.run('DELETE FROM budgets WHERE category_id=?',[id]);run('DELETE FROM categories WHERE id=?',[id]);go('set')}}
function pinForm(){modal(`<h3>Ganti PIN</h3><label>PIN lama<input id="o" type="password" inputmode="numeric" maxlength="6"></label><label>PIN baru (4–6 angka)<input id="n" type="password" inputmode="numeric" maxlength="6"></label><button class="btn" id="ps">Simpan</button>`);
$('#ps').onclick=async()=>{if(await H($('#o').value)!=localStorage.ph)return alert('PIN lama salah');if(!/^\d{4,6}$/.test($('#n').value))return alert('PIN baru harus 4–6 angka');localStorage.ph=await H($('#n').value);closeM();alert('PIN diganti')}}
// ===== Export / Backup =====
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1e3)}
function xl(){const wb=XLSX.utils.book_new(),tn={income:'Pemasukan',expense:'Pengeluaran',transfer:'Transfer'};
const T=q(`SELECT transaction_date,t.type,a.name an,b.name bn,c.name cn,amount,note FROM transactions t JOIN accounts a ON a.id=account_id LEFT JOIN accounts b ON b.id=to_account_id LEFT JOIN categories c ON c.id=category_id ORDER BY transaction_date`).map(t=>({Tanggal:t.transaction_date,Jenis:tn[t.type],Akun:t.an,'Ke Akun':t.bn||'',Kategori:t.cn||'',Nominal:t.amount,Catatan:t.note||''}));
const Bd=budgets().map(b=>{const x=bstat(b);return{Budget:b.name,Kategori:b.cn||'Global',Periode:b.period_type,Mulai:x.s,Sampai:x.e,Target:b.amount_limit,Terpakai:x.sp,Sisa:x.rem,Status:x.st}});
const M=q("SELECT DISTINCT substr(transaction_date,1,7) m FROM transactions ORDER BY m").map(r=>{const i=sumM(r.m,'income'),e=sumM(r.m,'expense');return{Bulan:r.m,'Total Pemasukan':i,'Total Pengeluaran':e,'Selisih (Saldo Akhir Bulan)':i-e}});
[['Detail Transaksi',T],['Ringkasan Budget',Bd],['Ringkasan Bulanan',M]].forEach(([n,d])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d),n));
XLSX.writeFile(wb,'akuntansi-'+iso(new Date())+'.xlsx')}
const bk=()=>dl(new Blob([db.export()],{type:'application/x-sqlite3'}),'akuntansi-'+iso(new Date())+'.sqlite');
// ===== Tampilan: Auto / Desktop / Mobile =====
const mq=matchMedia('(min-width:900px)');
function applyView(){const m=localStorage.vm||'auto';document.documentElement.classList.toggle('desk',m=='desktop'||(m=='auto'&&mq.matches));$('#vt').textContent={auto:'🔄 Auto',desktop:'🖥️ Desktop',mobile:'📱 Mobile'}[m]}
function toggleView(){const o=['auto','desktop','mobile'];localStorage.vm=o[(o.indexOf(localStorage.vm||'auto')+1)%3];applyView();if(!$('#app').hidden)go(view)}
mq.onchange=()=>{applyView();if(!$('#app').hidden)go(view)};applyView();
// ===== Init =====
(async()=>{SQL=await initSqlJs({locateFile:f=>'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/'+f});
const d=await idbGet();if(d){db=new SQL.Database(d);try{db.run('ALTER TABLE budgets ADD COLUMN auto_renew INTEGER DEFAULT 0')}catch(_){}}else{db=new SQL.Database();seed();await save()}
lock()})();
// ===== PWA =====
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

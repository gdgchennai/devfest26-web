import { getAgenda, getSpeakers } from "@/lib/content";
import { siteConfig } from "@/site.config";
import { floorTracks } from "@/lib/agenda-floors";
import { formatSessionTime } from "@/lib/format";
import { findSpeakers, joinSpeakerNames } from "@/lib/find-speaker";
import { sessionKey } from "@/lib/session-key";
import { trackColor } from "@/lib/track-color";
import type { AgendaSession, Speaker } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 300;

/**
 * `/event-agenda` — the event-day agenda as one small, self-contained HTML
 * document, for weak venue wifi and mobile data. A route handler on purpose:
 * it skips app/layout.tsx entirely, so none of the site's React, GSAP, Lenis
 * or three.js reaches the phone. Server-rendered text, inline CSS, ~4 KB of
 * inline vanilla JS, no fonts, no images, no extra requests until you act.
 * The JS only adds what needs a session: tabs, sign-in, stars, push, "now".
 * See docs/event-agenda.md.
 */

const esc = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sessionHtml(s: AgendaSession, speakers: Speaker[]): string {
  const names = joinSpeakerNames(findSpeakers(speakers, s.speakerSlugs));
  const meta = [s.level, s.type === "talk" ? null : s.type].filter(Boolean).join(" · ");
  const extra = [
    s.description ? `<p>${esc(s.description)}</p>` : "",
    s.prerequisites.length ? `<p><b>Before you come:</b> ${esc(s.prerequisites.join(", "))}</p>` : "",
  ].join("");
  const title = extra
    ? `<details><summary>${esc(s.title)}</summary>${extra}</details>`
    : `<span class="t">${esc(s.title)}</span>`;
  const isBreak = s.type === "break";
  return `<li class="s${isBreak ? " brk" : ""}" data-s="${esc(s.start)}" data-e="${esc(s.end)}">
<time>${formatSessionTime(s.start)}–${formatSessionTime(s.end)}</time>
<div class="b">${title}<small>${esc([names, s.hall, meta].filter(Boolean).join(" · "))}</small></div>
${isBreak ? "" : `<button type="button" class="star" data-k="${esc(sessionKey(s))}" aria-pressed="false" aria-label="Save ${esc(s.title)}">☆</button>`}
</li>`;
}

const CSS = `
:root{color-scheme:dark light;--bg:#000;--fg:#f0f0f0;--mute:#f0f0f099;--line:#f0f0f01f;--blue:#4285f4;--green:#34a853;--yellow:#f9ab00;--red:#ea4335;--purple:#a136f7;--blue-halftone:#57caff;--green-halftone:#5cdb6d;--yellow-halftone:#ffd427;--red-halftone:#ff7daf}
@media(prefers-color-scheme:light){:root{--bg:#fff;--fg:#111;--mute:#11111199;--line:#1111111f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.w{max-width:46rem;margin:0 auto;padding:1rem}
header{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;justify-content:space-between}
h1{font-size:1.25rem;margin:0}
#acct{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;font-size:.875rem;color:var(--mute)}
button{font:inherit;color:inherit;cursor:pointer}
.pill{border:1px solid var(--line);background:none;border-radius:99px;padding:.35rem .8rem;font-size:.8125rem}
.pill.on{background:var(--fg);color:var(--bg)}
#msg{display:none;margin:.75rem 0 0;padding:.6rem .9rem;border:1px solid var(--line);border-radius:.75rem;font-size:.875rem}
#msg.show{display:block}
nav{display:none;position:sticky;top:0;z-index:2;background:var(--bg);margin:0 -1rem;padding:.6rem 1rem;overflow-x:auto;white-space:nowrap;border-bottom:1px solid var(--line)}
.js nav{display:block}
[role=tab]{border:0;background:none;padding:.4rem .7rem;font-weight:600;color:var(--mute);border-bottom:2px solid transparent}
[role=tab][aria-selected=true]{color:var(--fg);border-color:var(--c)}
h2{font-size:1rem;margin:1.5rem 0 .25rem;color:var(--c)}
.js h2{display:none}
ol{list-style:none;margin:0;padding:0}
.s{display:flex;gap:.75rem;align-items:flex-start;padding:.85rem 0;border-bottom:1px solid var(--line)}
.s.now{background:color-mix(in srgb,var(--blue) 15%,transparent);margin:0 -1rem;padding-inline:1rem}
time{flex:0 0 6.5rem;font-size:.8125rem;color:var(--mute);font-variant-numeric:tabular-nums;padding-top:.15rem}
.b{flex:1;min-width:0}
.t,summary{font-weight:600}
summary{cursor:pointer}
details p{margin:.4rem 0 0;font-size:.875rem;color:var(--mute)}
small{display:block;color:var(--mute);margin-top:.15rem}
.brk .t,.brk summary{font-weight:400;color:var(--mute)}
.star{flex:none;width:2.5rem;height:2.5rem;border:1px solid var(--line);border-radius:50%;background:none;font-size:1.25rem;line-height:1}
.star[aria-pressed=true]{color:var(--yellow);border-color:var(--yellow)}
.live{display:block;width:fit-content;margin-top:.25rem;font-size:.6875rem;text-transform:uppercase;background:var(--blue);color:#fff;border-radius:99px;padding:.1rem .5rem}
footer{margin:2rem 0 1rem;font-size:.8125rem;color:var(--mute)}
a{color:inherit}
`;

// Runs after the HTML is parsed. Everything here is progressive: with JS off
// the page is still the full, readable schedule (every track stacked).
const JS = `(function(){
var d=document,$=function(s){return d.querySelector(s)},A=function(s){return[].slice.call(d.querySelectorAll(s))};
d.documentElement.className='js';
var tabs=A('[role=tab]'),panels=A('.panel');
function show(id,keep){if(!d.getElementById('t-'+id))id=tabs[0].dataset.t;
tabs.forEach(function(t){var on=t.dataset.t===id;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;if(on&&keep)t.scrollIntoView({inline:'center',block:'nearest'})});
panels.forEach(function(p){p.hidden=p.id!=='t-'+id});}
tabs.forEach(function(t){t.onclick=function(){show(t.dataset.t,1);history.replaceState(null,'','#'+t.dataset.t)}});
show(location.hash.slice(1));
var me=null,favs=new Set(),busy={},acct=$('#acct'),msg=$('#msg'),KEY=d.body.dataset.vapid;
function now(){var n=Date.now();A('.s').forEach(function(li){var on=n>=Date.parse(li.dataset.s)&&n<=Date.parse(li.dataset.e),b=li.querySelector('.live');li.classList.toggle('now',on);if(on&&!b){b=d.createElement('span');b.className='live';b.textContent='Now';li.querySelector('time').appendChild(b)}else if(!on&&b)b.remove()})}
now();setInterval(now,60000);
function paint(){A('.star').forEach(function(b){var on=favs.has(b.dataset.k);b.setAttribute('aria-pressed',on);b.textContent=on?'\\u2605':'\\u2606'})}
function note(t,btn){msg.textContent=t+' ';if(btn){var b=d.createElement('button');b.className='pill';b.textContent=btn;b.onclick=signIn;msg.appendChild(b)}msg.className='show'}
function form(path,f){var x=d.createElement('form');x.method='POST';x.action=path;for(var k in f){var i=d.createElement('input');i.type='hidden';i.name=k;i.value=f[k];x.appendChild(i)}d.body.appendChild(x);x.submit()}
function csrf(){return fetch('/api/auth/csrf').then(function(r){return r.json()}).then(function(j){return j.csrfToken})}
function signIn(){csrf().then(function(c){form('/api/auth/signin/google',{csrfToken:c,callbackUrl:'/event-agenda'+location.hash})}).catch(function(){note('Could not reach sign-in. Check your connection and try again.')})}
function signOut(){csrf().then(function(c){form('/api/auth/signout',{csrfToken:c,callbackUrl:'/event-agenda'})})}
function acctUi(){acct.textContent='';
if(!me){var b=d.createElement('button');b.className='pill';b.textContent='Sign in';b.onclick=signIn;acct.appendChild(b);return}
var n=d.createElement('span');n.textContent=me.name||me.email||'Signed in';acct.appendChild(n);
var o=d.createElement('button');o.className='pill';o.textContent='Sign out';o.onclick=signOut;acct.appendChild(o);pushUi()}
d.addEventListener('click',function(e){var b=e.target.closest('.star');if(!b)return;
if(!me){note('Sign in to save sessions to your agenda.','Sign in');return}
var k=b.dataset.k;if(busy[k])return;busy[k]=1;var add=!favs.has(k);
add?favs.add(k):favs.delete(k);paint();
fetch('/api/favorites',{method:add?'POST':'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({sessionKey:k})})
.then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){favs=new Set(j.favorites||[])})
.catch(function(){add?favs.delete(k):favs.add(k);note('Could not save that. Check your connection.')})
.then(function(){busy[k]=0;paint()})});
function reg(){return navigator.serviceWorker.getRegistration('/sw.js')}
function u8(s){var p=s+'='.repeat((4-s.length%4)%4),r=atob(p.replace(/-/g,'+').replace(/_/g,'/')),a=new Uint8Array(r.length);for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i);return a}
function ok(){return KEY&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&Notification.permission!=='denied'&&!(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!matchMedia('(display-mode: standalone)').matches)}
function save(s){return fetch('/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(s.toJSON())})}
function pushUi(){if(!ok())return;var b=d.createElement('button');b.className='pill';b.textContent='Notifications';b.disabled=true;acct.insertBefore(b,acct.lastChild);
function set(on){b.className='pill'+(on?' on':'');b.textContent=on?'Notifications on \\u2713':'Get notifications';b.disabled=false;b.onclick=on?off:sub}
function off(){b.disabled=true;reg().then(function(r){return r&&r.pushManager.getSubscription()}).then(function(s){if(!s)return;return fetch('/api/push/subscribe',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:s.endpoint})}).then(function(){return s.unsubscribe()})}).then(function(){set(false)},function(){set(true)})}
function sub(){b.disabled=true;navigator.serviceWorker.register('/sw.js').then(function(r){return Notification.requestPermission().then(function(p){if(p!=='granted')throw 0;return r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(KEY)})})}).then(function(s){return save(s).then(function(r){if(!r.ok)return s.unsubscribe().then(function(){throw 0});set(true)})}).catch(function(){set(false);if(Notification.permission==='denied')b.remove();else note('Could not turn on notifications.')})}
reg().then(function(r){return r&&r.pushManager.getSubscription()}).then(function(s){if(s)save(s);set(!!s)},function(){set(false)})}
acctUi();
fetch('/api/auth/session').then(function(r){return r.json()}).then(function(s){me=s&&s.user||null;acctUi();
if(me)return fetch('/api/favorites').then(function(r){return r.ok?r.json():{}}).then(function(j){favs=new Set(j.favorites||[]);paint()})}).catch(function(){});
})();`;

export async function GET(): Promise<Response> {
  const [agenda, speakers] = await Promise.all([getAgenda(), getSpeakers()]);

  const tracks = [
    ...siteConfig.floors.flatMap((f) => floorTracks(f, siteConfig.tracks)),
    ...siteConfig.tracks.filter((t) => !siteConfig.floors.some((f) => f.tracks.includes(t.slug))),
  ];

  // Breaks (lunch, quick breaks, check-in) are shown, without a star. A track
  // gets a tab only if it has a real session; venue-wide ones (track null)
  // appear in every tab, same as the agenda's simple list.
  const sorted = [...agenda].sort((a, b) => a.start.localeCompare(b.start));
  const groups = tracks
    .filter((track) => sorted.some((s) => s.type !== "break" && s.track === track.slug))
    .map((track) => ({ track, sessions: sorted.filter((s) => s.track === track.slug || s.track === null) }));

  const tabs = groups
    .map(
      (g) =>
        `<button type="button" role="tab" data-t="${g.track.slug}" style="--c:${trackColor(g.track.slug).cssVar}">${esc(g.track.name)}</button>`,
    )
    .join("");
  const panels = groups
    .map(
      (g) =>
        `<section class="panel" id="t-${g.track.slug}" style="--c:${trackColor(g.track.slug).cssVar}"><h2>${esc(g.track.name)}</h2><ol>${g.sessions
          .map((s) => sessionHtml(s, speakers))
          .join("")}</ol></section>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Agenda — ${esc(siteConfig.name)}</title>
<style>${CSS}</style>
</head>
<body data-vapid="${esc(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "")}">
<div class="w">
<header><h1>${esc(siteConfig.name)} · Agenda</h1><div id="acct"></div></header>
<p id="msg" role="status"></p>
<nav role="tablist" aria-label="Tracks">${tabs}</nav>
<main>${panels}</main>
<footer>Lightweight view. <a href="/agenda">Full agenda</a></footer>
</div>
<script>${JS}</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Let Cloudflare and phones reuse it for a few minutes; stale is fine
      // while a fresh copy is fetched, so a weak connection never blocks on it.
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      "x-robots-tag": "noindex",
    },
  });
}

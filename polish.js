/* =================================================================
   v2 polish — 연출 모음 (셀 미리보기 · 컨페티 · 소나 · 도장 · 모달 모핑 · 팁).
   index.html 의 메인 스크립트 다음, 부팅 스크립트 앞에서 읽힌다 (전역 함수·상태를 그대로 쓴다).
   메인 코드는 window._animateModalOpen / _animateModalClose / _onDiceWinner /
   _voteBurst / _sonar / _startTips 로만 부른다 — 이 파일이 없어도 앱은 동작한다.
   ================================================================= */
(function v2Polish(){
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Geist 리디자인에서 제거된 효과: 커서 보더 글로우, 3D 틸트,
     클릭 리플, 히어로 블롭 패럴랙스, 마그네틱 버튼.
     장식보다 콘텐츠 — 남긴 모션은 상태 변화를 설명하는 것들뿐. */

  /* (3) Cell hover preview — built from in-memory data D[y][m][d].
     Only enabled for fine pointer (mouse) — on touch devices, synthetic
     mouseover events make the preview flicker on tap. */
  const FINE_POINTER = matchMedia('(pointer: fine)').matches;
  let _pv = null, _pvTimer = null;
  function getPv(){
    if(_pv) return _pv;
    _pv = document.createElement('div');
    _pv.className = 'cell-preview';
    document.body.appendChild(_pv);
    return _pv;
  }
  function hidePv(){ if(_pv) _pv.classList.remove('in'); }
  function showPvFor(cell){
    const dnEl = cell.querySelector('.dn');
    if(!dnEl) return;
    const dn = parseInt(dnEl.textContent, 10);
    if(!dn) return;
    const dat = (((D[curYear]||{})[cur])||{})[dn];
    const list = (dat && dat.entries) || [];
    if(list.length === 0) return;
    const sorted = list.slice().sort((a,b) => (b.voters.size - a.voters.size) || (a.id - b.id));
    const pv = getPv();
    const dow = DOW_KR[new Date(curYear, cur-1, dn).getDay()];
    pv.innerHTML =
      '<div class="cp-title">'+cur+'월 '+dn+'일 ('+dow+') · '+list.length+'개 후보</div>' +
      sorted.map(e => {
        const v = e.voters.size, my = e.voters.has(MY_VOTER_ID);
        return '<div class="cp-row">' +
          '<span class="cp-dot'+(my?' voted':'')+'"></span>' +
          '<span class="cp-name">'+esc(e.name)+'</span>' +
          (v>0 ? '<span class="cp-count'+(my?' voted':'')+'">👍 '+v+'</span>' : '') +
          '</div>';
      }).join('');
    const r = cell.getBoundingClientRect();
    const pvw = pv.offsetWidth || 280;
    const pvh = pv.offsetHeight || 120;
    let x = r.left + r.width/2 - pvw/2;
    let y = r.top - pvh - 10;
    if(x < 10) x = 10;
    if(x + pvw > innerWidth - 10) x = innerWidth - 10 - pvw;
    if(y < 10) y = r.bottom + 10;
    pv.style.left = x + 'px';
    pv.style.top  = y + 'px';
    requestAnimationFrame(() => pv.classList.add('in'));
  }
  document.addEventListener('mouseover', e => {
    if(!FINE_POINTER) return;
    const cell = e.target.closest('.cell');
    if(!cell || cell.classList.contains('empty') || cell.classList.contains('skeleton')){
      clearTimeout(_pvTimer); hidePv(); return;
    }
    clearTimeout(_pvTimer);
    _pvTimer = setTimeout(() => showPvFor(cell), 420);
  });
  document.addEventListener('mouseout', e => {
    if(!FINE_POINTER) return;
    const from = e.target.closest('.cell');
    const to   = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.cell');
    if(from && from !== to){
      clearTimeout(_pvTimer);
      hidePv();
    }
  });

  /* (4) Confetti + vote-burst */
  let _confettiHost = null;
  function getHost(){
    if(_confettiHost) return _confettiHost;
    _confettiHost = document.createElement('div');
    _confettiHost.className = 'confetti-host';
    document.body.appendChild(_confettiHost);
    return _confettiHost;
  }
  const FOOD_EMOJIS = ['🍜','🍙','🥟','🍣','🍱','🍛','🌮','🍕','🥗','🍰','🍩','🍔','🥪','🍝','🍤','🍲','🥘','🍚'];
  function fireConfetti(el){
    if(REDUCE) return;
    const host = getHost();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    // Pull live theme colors from CSS vars so confetti tints with the palette.
    const cs = getComputedStyle(document.documentElement);
    const COLORS = [
      cs.getPropertyValue('--accent').trim()    || '#C8553D',
      cs.getPropertyValue('--secondary').trim() || '#588157',
      cs.getPropertyValue('--highlight').trim() || '#F2B441',
      '#D17A8D', '#8E5A8C', '#7C9EF2',
    ];
    const total = 30;
    for(let i = 0; i < total; i++){
      // ~60% food emojis, ~40% color rects — keeps the rainbow burst alive
      // but flips the character into a clearly food-themed celebration.
      const isEmoji = Math.random() < 0.6;
      const p = document.createElement('div');
      if(isEmoji){
        p.className = 'confetti-emoji';
        p.textContent = FOOD_EMOJIS[Math.floor(Math.random()*FOOD_EMOJIS.length)];
      } else {
        p.className = 'confetti-piece';
        p.style.background = COLORS[i % COLORS.length];
      }
      p.style.left = cx + 'px';
      p.style.top  = cy + 'px';
      const angle = (i / total) * Math.PI * 2 + Math.random()*0.6;
      const dist  = 140 + Math.random()*140;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 40;
      p.style.setProperty('--cx', dx + 'px');
      p.style.setProperty('--cy', dy + 'px');
      p.style.setProperty('--cr', ((Math.random()-.5)*1440) + 'deg');
      p.style.animationDelay = (Math.random()*0.12) + 's';
      host.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }
  // Steam wisps rising above the winner card — food-themed "갓 만든 점심" vibe.
  function spawnSteam(el){
    if(REDUCE) return;
    const host = getHost();
    const r = el.getBoundingClientRect();
    const baseX = r.left + r.width/2;
    const baseY = r.top + 6;
    for(let i = 0; i < 5; i++){
      const w = document.createElement('div');
      w.className = 'steam-wisp';
      const off = (i - 2) * 10 + (Math.random()-0.5)*8;
      w.style.left = (baseX + off) + 'px';
      w.style.top  = baseY + 'px';
      w.style.setProperty('--sx', (off*1.4 + (Math.random()-0.5)*22) + 'px');
      w.style.animationDelay = (i * 0.11 + Math.random()*0.06) + 's';
      host.appendChild(w);
      setTimeout(() => w.remove(), 2400);
    }
  }
  // 요소 테두리에서 바깥으로 퍼지는 링 — 가로·세로 모두 같은 px 만큼 번지도록
  // 축별 scale 을 따로 계산한다 (작은 버튼은 덜, 큰 칸은 더 — 최대 사방 22px).
  // count 개를 시간차로 쏘면 소나처럼 보인다.
  function sonar(el, color, count){
    if(REDUCE || !el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if(!r.width) return;
    const host = getHost();
    const radius = getComputedStyle(el).borderRadius || '12px';
    const grow = Math.max(18, Math.min(44, Math.min(r.width, r.height) * .7));
    for(let i = 0; i < (count || 1); i++){
      const ring = document.createElement('div');
      ring.className = 'sonar-ring';
      ring.style.left = r.left + 'px';
      ring.style.top = r.top + 'px';
      ring.style.width = r.width + 'px';
      ring.style.height = r.height + 'px';
      ring.style.borderRadius = radius;
      if(color) ring.style.setProperty('--ring-c', color);
      ring.style.setProperty('--ring-sx', ((r.width + grow) / r.width).toFixed(3));
      ring.style.setProperty('--ring-sy', ((r.height + grow) / r.height).toFixed(3));
      ring.style.animationDelay = (i * 0.18) + 's';
      host.appendChild(ring);
      setTimeout(() => ring.remove(), 1000 + i * 180);
    }
  }
  // 당첨 도장 — 당첨 카드 오른쪽에 쾅 찍힌다
  const STAMP_TEXTS = ['당첨!', '오늘은 여기!', '이걸로 가자!', 'PICK!'];
  function stamp(el){
    if(REDUCE || !el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if(!r.width) return;
    const s = document.createElement('div');
    s.className = 'win-stamp';
    s.textContent = STAMP_TEXTS[Math.floor(Math.random() * STAMP_TEXTS.length)];
    s.style.left = Math.max(60, Math.min(innerWidth - 60, r.right - Math.min(70, r.width * .25))) + 'px';
    s.style.top = (r.top + Math.min(r.height / 2, 28)) + 'px';
    getHost().appendChild(s);
    setTimeout(() => s.remove(), 2400);
  }
  // 룰렛이 당첨자에 멈춘 순간 (점심·회식 공통) — 도장 쾅 → 링 → 김 + 컨페티
  window._onDiceWinner = function(w){
    if(!w || !w.isConnected) return;
    stamp(w);
    setTimeout(() => sonar(w, 'var(--accent)', 2), 120);
    setTimeout(() => { if(w.isConnected){ spawnSteam(w); fireConfetti(w); } }, 200);
  };
  window._sonar = sonar;

  function spawnVoteBurst(btn){
    if(REDUCE) return;
    const r = btn.getBoundingClientRect();
    const host = getHost();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;
    // 팔레트 색을 섞어 터뜨린다 — 액센트 위주 + 하이라이트/세컨더리 포인트
    const cs = getComputedStyle(document.documentElement);
    const COLORS = [
      cs.getPropertyValue('--accent').trim(),
      cs.getPropertyValue('--highlight').trim(),
      cs.getPropertyValue('--accent').trim(),
      cs.getPropertyValue('--secondary').trim(),
    ];
    for(let i = 0; i < 12; i++){
      const p = document.createElement('div');
      p.className = 'vote-burst';
      p.style.left = (cx - 2.5) + 'px';
      p.style.top  = (cy - 2.5) + 'px';
      p.style.background = COLORS[i % COLORS.length] || '';
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 24 + Math.random()*18;
      p.style.setProperty('--bx', Math.cos(angle)*dist + 'px');
      p.style.setProperty('--by', (Math.sin(angle)*dist - 6) + 'px');
      p.style.animationDelay = (i*0.015) + 's';
      host.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
    sonar(btn, 'var(--accent)', 1);
  }
  // 투표 확정 시 _animateVote 가 +1 과 함께 호출한다. (예전엔 document click
  // 리스너였는데, 투표 버튼들이 stopPropagation 을 해서 한 번도 발동하지 않았다)
  window._voteBurst = spawnVoteBurst;

  // Click ripple on the dice button — radial flare originating from the
  // cursor. Respects reduced motion via the global keyframes override.
  document.addEventListener('pointerdown', e => {
    const btn = e.target.closest && e.target.closest('.dice-btn');
    if(!btn || btn.disabled) return;
    const r = btn.getBoundingClientRect();
    btn.style.setProperty('--rx', (e.clientX - r.left) + 'px');
    btn.style.setProperty('--ry', (e.clientY - r.top)  + 'px');
    btn.classList.remove('ripple');
    void btn.offsetWidth; // restart animation
    btn.classList.add('ripple');
    setTimeout(() => btn.classList.remove('ripple'), 600);
  });

  /* (5) 모달 — 클릭한 칸에서 자라나오고(container transform), 닫으면 그 칸으로
     다시 쏙 들어간다. 콘텐츠를 찌그러뜨리는 scale 대신 clip-path 창을 칸 크기에서
     모달 크기로 넓히면서 위치만 옮긴다. 출발점이 없으면(키보드·설정 패널 등)
     살짝 기울어진 채 떠오르는 기본 진입. */
  const ORIGIN_SEL = '.cell, .more-lnk, .today-leader, .today-row, .ti-add, .today-empty, .bd-wd, .dinner-banner, .dinner-tag, .help-btn, [data-twk-dinner-open]';
  let _lastOrigin = null;   // 마지막 클릭 { el, t } — 모달을 연 클릭인지 시간으로 판별
  let _openOrigin = null;   // 지금 열린 모달의 출발점 — 닫을 때 다시 찾아 들어갈 단서들
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest(ORIGIN_SEL);
    if(el) _lastOrigin = { el, t: Date.now() };
  }, true);

  function cellForDay(day){
    return [...document.querySelectorAll('#calGrid .cell:not(.empty)')]
      .find(c => { const d = c.querySelector('.dn'); return d && +d.textContent === day; }) || null;
  }
  function describeOrigin(el){
    // 투표·추가로 rerender 되면 원래 요소는 사라지므로 다시 찾을 단서를 함께 저장
    const host = el.closest('.cell');
    const dn = host && host.querySelector('.dn');
    const row = el.closest('[data-entry-id]');
    return {
      el,
      day: dn ? +dn.textContent : null,
      entryId: row ? row.getAttribute('data-entry-id') : null,
      cls: el.classList.contains('dinner-banner') ? '.dinner-banner'
         : el.classList.contains('ti-add') ? '.today-card .ti-add'
         : el.classList.contains('help-btn') ? '.help-btn' : null,
    };
  }
  function visibleRect(el){
    if(!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    if(!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    return r;
  }
  function resolveOrigin(o){
    if(!o) return null;
    const tries = [
      () => o.el,
      () => o.entryId && document.querySelector('[data-entry-id="' + o.entryId + '"]'),
      () => o.day && cellForDay(o.day),
      () => o.cls && document.querySelector(o.cls),
    ];
    for(const f of tries){ const el = f(); const r = visibleRect(el); if(r) return { el, r }; }
    return null;
  }
  // 모달 rect(mr)와 출발 rect(or) → 출발점에 겹치는 transform + clip 창
  function morphFrom(mr, or){
    const dx = (or.left + or.width/2) - (mr.left + mr.width/2);
    const dy = (or.top + or.height/2) - (mr.top + mr.height/2);
    const ih = Math.max(0, (mr.height - or.height) / 2);
    const iw = Math.max(0, (mr.width - or.width) / 2);
    return {
      transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(.98)',
      clipPath: 'inset(' + ih + 'px ' + iw + 'px round 12px)',
    };
  }
  // 그림자까지 보이도록 끝 상태는 바깥으로 넉넉히 연 inset
  const MORPH_OPEN = { transform: 'translate(0px, 0px) scale(1)', clipPath: 'inset(-48px -48px round 16px)' };

  function animateModalOpen(){
    requestAnimationFrame(() => {
      const m = document.querySelector('#mw .modal');
      if(!m || REDUCE || typeof m.animate !== 'function') return;
      const bd = m.closest('.backdrop');
      const mr = m.getBoundingClientRect();
      const fresh = _lastOrigin && Date.now() - _lastOrigin.t < 800 ? _lastOrigin.el : null;
      const src = fresh || (document.activeElement && document.activeElement.closest && document.activeElement.closest(ORIGIN_SEL));
      _openOrigin = src ? describeOrigin(src) : null;
      _lastOrigin = null;
      const or = src && visibleRect(src);
      if(bd){
        // 배경 비네트의 밝은 중심을 출발점에 둔다
        const cx = or ? or.left + or.width/2 : innerWidth/2;
        const cy = or ? or.top + or.height/2 : innerHeight/2;
        bd.style.setProperty('--bx', cx + 'px');
        bd.style.setProperty('--by', cy + 'px');
      }
      if(or){
        const from = morphFrom(mr, or);
        m.animate([
          { ...from, opacity: 0 },
          { opacity: 1, offset: .2 },
          { ...MORPH_OPEN, opacity: 1 }
        ], { duration: 520, easing: 'cubic-bezier(.2, .85, .25, 1)' });
      } else {
        m.style.transformOrigin = '50% 0';
        m.animate([
          { opacity: 0, transform: 'perspective(1000px) rotateX(-14deg) translateY(28px) scale(.92)' },
          { opacity: 1, transform: 'perspective(1000px) rotateX(2deg) translateY(-3px) scale(1.005)', offset: .7 },
          { opacity: 1, transform: 'perspective(1000px) rotateX(0) translateY(0) scale(1)' }
        ], { duration: 460, easing: 'cubic-bezier(.22, 1, .36, 1)' }).onfinish = () => { m.style.transformOrigin = ''; };
      }
      // 내용은 창이 거의 열렸을 때 위에서부터 차례로 떠오른다
      [...m.children].forEach((c, i) => {
        c.animate([
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 340, delay: (or ? 110 : 80) + i * 45, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
      });
    });
  }

  // 닫는 애니메이션 — closeMod 가 부른다. 다 끝나면 finish() 로 #mw 를 비우게 하고,
  // 실제로 닫혔으면(finish 가 true) 출발했던 칸이 살짝 받아주는 착지 반응을 보여준다.
  function animateModalClose(m, finish){
    // Cancel any running animations on the modal (a still-running open
    // animation, or a leftover one from before) so this close starts from a
    // clean transform stack and isn't visually absorbed by them.
    if(typeof m.getAnimations === 'function'){
      m.getAnimations({ subtree: true }).forEach(a => { try { a.cancel(); } catch(e){} });
    }
    // 출발한 칸이 아직 화면에 있으면 그 칸으로 빨려 들어가고, 없으면 기울며 가라앉는다
    const target = REDUCE ? null : resolveOrigin(_openOrigin);
    _openOrigin = null;
    if(typeof m.animate !== 'function'){ setTimeout(finish, 220); return; }
    let anim, dur;
    if(target){
      dur = 400;
      anim = m.animate([
        { ...MORPH_OPEN, opacity: 1 },
        { opacity: 1, offset: .72 },
        { ...morphFrom(m.getBoundingClientRect(), target.r), opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'forwards' });
    } else {
      dur = 260;
      m.style.transformOrigin = '50% 100%';
      anim = m.animate([
        { opacity: 1, transform: 'perspective(1000px) rotateX(0) translateY(0) scale(1)' },
        { opacity: 0, transform: 'perspective(1000px) rotateX(12deg) translateY(26px) scale(.93)' }
      ], { duration: dur, easing: 'cubic-bezier(.55, 0, .75, .3)', fill: 'forwards' });
    }
    let done = false;
    const end = () => {
      if(done) return;
      done = true;
      if(!finish()) return;
      if(target && target.el.isConnected && typeof target.el.animate === 'function'){
        target.el.animate(
          [{ transform: 'scale(.96)' }, { transform: 'scale(1.025)', offset: .5 }, { transform: 'scale(1)' }],
          { duration: 380, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
        );
        sonar(target.el, 'var(--accent)', 1);
      }
    };
    anim.onfinish = end;
    // Safety net — if onfinish doesn't fire (e.g. WAA bug), clean up anyway.
    setTimeout(end, dur + 150);
  }

  // 모달을 여는 쪽(_modalOpened)·닫는 쪽(closeMod)에서 부른다
  window._animateModalOpen = animateModalOpen;
  window._animateModalClose = animateModalClose;

  /* (6) 팁 로테이터 — 이번 달에 기록이 하나도 없으면 아래 안내 자리에서 팁을 돌린다.
     render() 가 빈 달을 그릴 때마다 _startTips() 를 부르고, 기록이 생기면 다음 차례에 스스로 멈춘다. */
  const TIPS = [
    '🎲 메뉴 정해줘! 는 오늘 후보 전부 중에서 무작위로 뽑아요',
    '⌨️ ← → 키로 달 이동 · T 또는 Home 으로 오늘로',
    '🌙 D 키로 다크 모드 바로 토글',
    '👥 한 사람당 항목별 1표 · 한 디바이스 = 1명',
    '📌 매달 마지막 금요일은 자동으로 공동휴무 표시',
  ];
  let _tipIdx = 0, _tipTimer = null;
  function showTip(){
    const n = document.getElementById('notice');
    if(!n || hasDat(curYear, cur)){ clearInterval(_tipTimer); _tipTimer = null; return; }
    n.innerHTML = '<span class="tip-rotator"><span class="tip">'+TIPS[_tipIdx]+'</span></span>';
  }
  window._startTips = function(){
    showTip();
    if(!_tipTimer) _tipTimer = setInterval(() => { _tipIdx = (_tipIdx + 1) % TIPS.length; showTip(); }, 5500);
  };

})();

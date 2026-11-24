(function () {
  'use strict';

  var SET_COUNT = 5;      // 한 번에 뽑는 세트 수
  var PICK_COUNT = 6;     // 세트당 번호 개수
  var MAX_NUMBER = 45;    // 번호 범위: 1 ~ 45
  var ROW_LABELS = ['A', 'B', 'C', 'D', 'E'];
  var STORAGE_KEY = 'myLottoNumbers';

  var drawButton = document.getElementById('drawButton');
  var drawList = document.getElementById('drawList');
  var drawHint = document.getElementById('drawHint');
  var drawActions = document.getElementById('drawActions');
  var selectAll = document.getElementById('selectAll');
  var saveSelectedButton = document.getElementById('saveSelectedButton');
  var savedList = document.getElementById('savedList');
  var savedEmpty = document.getElementById('savedEmpty');
  var savedCount = document.getElementById('savedCount');
  var savedActions = document.getElementById('savedActions');
  var selectAllSaved = document.getElementById('selectAllSaved');
  var deleteSelectedButton = document.getElementById('deleteSelectedButton');
  var storageNotice = document.getElementById('storageNotice');
  var statusRegion = document.getElementById('status');

  var currentDraw = [];   // 이번에 뽑은 5세트. 각 세트는 오름차순 번호 배열
  var selectedRows = [];  // 줄별 체크 여부 (true / false)
  var savedSets = [];     // 내 로또 번호. { id, numbers, savedAt } 최신순
  var selectedSavedIds = {};  // 삭제하려고 체크한 저장 항목 id
  var storageWorks = true;

  var timeFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

  /* ---------- 번호 뽑기 ---------- */

  // 0 이상 limit 미만의 정수를 고르게 뽑는다.
  function randomInt(limit) {
    var cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      var range = 0x100000000;
      var ceiling = range - (range % limit);   // 한쪽으로 쏠리지 않게 넘치는 값은 버린다
      var buffer = new Uint32Array(1);
      do {
        cryptoObj.getRandomValues(buffer);
      } while (buffer[0] >= ceiling);
      return buffer[0] % limit;
    }
    return Math.floor(Math.random() * limit);
  }

  // 1~45 중 겹치지 않는 6개를 뽑아 오름차순으로 돌려준다.
  function drawOneSet() {
    var pool = [];
    for (var n = 1; n <= MAX_NUMBER; n++) pool.push(n);

    for (var i = 0; i < PICK_COUNT; i++) {
      var j = i + randomInt(pool.length - i);
      var picked = pool[j];
      pool[j] = pool[i];
      pool[i] = picked;
    }
    return pool.slice(0, PICK_COUNT).sort(function (a, b) { return a - b; });
  }

  // 서로 다른 5세트를 뽑는다.
  function drawSets() {
    var sets = [];
    var seen = {};
    while (sets.length < SET_COUNT) {
      var set = drawOneSet();
      var key = keyOf(set);
      if (!seen[key]) {
        seen[key] = true;
        sets.push(set);
      }
    }
    return sets;
  }

  function keyOf(numbers) {
    return numbers.join('-');
  }

  /* ---------- 저장소 ---------- */

  function isValidSet(numbers) {
    if (!Array.isArray(numbers) || numbers.length !== PICK_COUNT) return false;
    var seen = {};
    for (var i = 0; i < numbers.length; i++) {
      var n = numbers[i];
      if (typeof n !== 'number' || n % 1 !== 0 || n < 1 || n > MAX_NUMBER || seen[n]) return false;
      seen[n] = true;
    }
    return true;
  }

  function readStorage() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && isValidSet(item.numbers);
      }).map(function (item) {
        return {
          id: String(item.id || keyOf(item.numbers)),
          numbers: item.numbers.slice().sort(function (a, b) { return a - b; }),
          savedAt: typeof item.savedAt === 'number' ? item.savedAt : Date.now()
        };
      });
    } catch (error) {
      storageWorks = false;
      return [];
    }
  }

  function writeStorage() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSets));
      storageWorks = true;
    } catch (error) {
      storageWorks = false;
    }
    storageNotice.hidden = storageWorks;
  }

  function isSaved(numbers) {
    var key = keyOf(numbers);
    return savedSets.some(function (item) { return keyOf(item.numbers) === key; });
  }

  /* ---------- 화면 그리기 ---------- */

  function bandOf(number) {
    return 'band-' + Math.ceil(number / 10);   // 1–10, 11–20, 21–30, 31–40, 41–45
  }

  function createBall(number) {
    var ball = document.createElement('span');
    if (number === null) {
      ball.className = 'ball is-empty';
    } else {
      ball.className = 'ball ' + bandOf(number);
      ball.textContent = number;
    }
    return ball;
  }

  function createBalls(numbers) {
    var wrap = document.createElement('div');
    wrap.className = 'balls';
    for (var i = 0; i < PICK_COUNT; i++) {
      wrap.appendChild(createBall(numbers ? numbers[i] : null));
    }
    return wrap;
  }

  // 이번에 뽑은 번호 A~E 줄. animate가 true면 공이 차례로 튀어나온다.
  function renderDraw(animate) {
    drawList.textContent = '';

    ROW_LABELS.forEach(function (label, rowIndex) {
      var numbers = currentDraw[rowIndex] || null;

      var row = document.createElement('li');
      row.className = 'draw-row';
      row.dataset.row = rowIndex;

      // 체크박스 + 줄 이름 + 공을 label 하나로 묶어, 줄 어디를 눌러도 체크된다.
      var pick = document.createElement('label');
      pick.className = 'row-pick';

      var check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'row-check';
      check.dataset.row = rowIndex;
      pick.appendChild(check);

      var rowLabel = document.createElement('span');
      rowLabel.className = 'row-label';
      rowLabel.setAttribute('aria-hidden', 'true');
      rowLabel.textContent = label;
      pick.appendChild(rowLabel);

      var balls = createBalls(numbers);
      balls.setAttribute('aria-hidden', 'true');
      if (numbers && animate) {
        Array.prototype.forEach.call(balls.children, function (ball, ballIndex) {
          ball.classList.add('pop');
          ball.style.animationDelay = (rowIndex * 70 + ballIndex * 35) + 'ms';
        });
      }
      pick.appendChild(balls);
      row.appendChild(pick);

      var chip = document.createElement('span');
      chip.className = 'saved-chip';
      chip.textContent = '저장됨';
      chip.hidden = true;
      row.appendChild(chip);

      drawList.appendChild(row);
    });

    drawHint.hidden = currentDraw.length > 0;
    drawActions.hidden = currentDraw.length === 0;
    updateDrawState();
  }

  // 체크박스, 저장됨 표시, 모두 선택, 저장 버튼을 현재 상태에 맞춘다.
  function updateDrawState() {
    var selectableCount = 0;
    var selectedCount = 0;

    var rows = drawList.querySelectorAll('.draw-row');
    Array.prototype.forEach.call(rows, function (row) {
      var rowIndex = Number(row.dataset.row);
      var numbers = currentDraw[rowIndex];
      var label = ROW_LABELS[rowIndex];
      var check = row.querySelector('.row-check');
      var chip = row.querySelector('.saved-chip');

      var saved = Boolean(numbers) && isSaved(numbers);
      var selectable = Boolean(numbers) && !saved;
      if (!selectable) selectedRows[rowIndex] = false;   // 이미 저장한 줄은 선택에서 뺀다
      var selected = Boolean(selectedRows[rowIndex]);

      if (selectable) selectableCount++;
      if (selected) selectedCount++;

      check.checked = selected;
      check.disabled = !selectable;
      chip.hidden = !saved;
      row.classList.toggle('is-selected', selected);
      row.classList.toggle('is-locked', !selectable);

      if (!numbers) {
        check.setAttribute('aria-label', label + '세트 (아직 번호 없음)');
      } else {
        check.setAttribute('aria-label',
          label + '세트 ' + numbers.join(', ') + (saved ? ' (저장됨)' : ' 선택'));
      }
    });

    selectAll.disabled = selectableCount === 0;
    selectAll.checked = selectableCount > 0 && selectedCount === selectableCount;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < selectableCount;

    saveSelectedButton.disabled = selectedCount === 0;
    saveSelectedButton.textContent = selectedCount > 0
      ? '선택한 ' + selectedCount + '세트 저장'
      : '선택한 번호 저장';
  }

  // newIds: 방금 저장한 항목의 id 목록 (잠깐 강조 표시)
  function renderSaved(newIds) {
    savedList.textContent = '';

    savedSets.forEach(function (item) {
      var row = document.createElement('li');
      row.className = 'saved-row';
      if (newIds && newIds.indexOf(item.id) !== -1) row.classList.add('is-new');

      // 체크박스 + 번호 + 저장 시각을 label 하나로 묶어, 줄 어디를 눌러도 체크된다.
      var pick = document.createElement('label');
      pick.className = 'saved-pick';

      var check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'row-check saved-check';
      check.dataset.id = item.id;
      check.setAttribute('aria-label', item.numbers.join(', ') + ' 선택');
      pick.appendChild(check);

      var info = document.createElement('div');
      var balls = createBalls(item.numbers);
      balls.setAttribute('aria-hidden', 'true');
      info.appendChild(balls);

      var time = document.createElement('time');
      time.className = 'saved-time';
      time.dateTime = new Date(item.savedAt).toISOString();
      time.textContent = timeFormat.format(new Date(item.savedAt)) + ' 저장';
      info.appendChild(time);
      pick.appendChild(info);
      row.appendChild(pick);

      savedList.appendChild(row);
    });

    var count = savedSets.length;
    savedCount.textContent = count > 0 ? count : '';
    savedEmpty.hidden = count > 0;
    savedActions.hidden = count === 0;
    updateSavedSelection();
    updateDrawState();
  }

  // 저장 목록의 체크 상태, 모두 선택, 삭제 버튼을 맞춘다.
  function updateSavedSelection() {
    // 이미 없어진 항목의 선택은 지운다.
    var stillThere = {};
    savedSets.forEach(function (item) { stillThere[item.id] = true; });
    Object.keys(selectedSavedIds).forEach(function (id) {
      if (!stillThere[id]) delete selectedSavedIds[id];
    });

    var selectedCount = 0;
    var checks = savedList.querySelectorAll('.saved-check');
    Array.prototype.forEach.call(checks, function (check) {
      var selected = Boolean(selectedSavedIds[check.dataset.id]);
      check.checked = selected;
      check.closest('.saved-row').classList.toggle('is-selected', selected);
      if (selected) selectedCount++;
    });

    var total = savedSets.length;
    selectAllSaved.disabled = total === 0;
    selectAllSaved.checked = total > 0 && selectedCount === total;
    selectAllSaved.indeterminate = selectedCount > 0 && selectedCount < total;

    deleteSelectedButton.disabled = selectedCount === 0;
    deleteSelectedButton.textContent = selectedCount > 0
      ? '선택한 ' + selectedCount + '세트 삭제'
      : '선택한 번호 삭제';
  }

  function announce(message) {
    statusRegion.textContent = '';
    window.setTimeout(function () { statusRegion.textContent = message; }, 50);
  }

  /* ---------- 동작 ---------- */

  drawButton.addEventListener('click', function () {
    currentDraw = drawSets();
    selectedRows = [];
    renderDraw(true);
    announce('새 번호 5세트를 뽑았습니다.');
  });

  // 줄 하나 체크 / 해제
  drawList.addEventListener('change', function (event) {
    var check = event.target;
    if (!check.classList || !check.classList.contains('row-check')) return;

    selectedRows[Number(check.dataset.row)] = check.checked;
    updateDrawState();
  });

  // 모두 선택 / 모두 해제 (이미 저장한 줄은 제외)
  selectAll.addEventListener('change', function () {
    var checked = selectAll.checked;
    currentDraw.forEach(function (numbers, rowIndex) {
      selectedRows[rowIndex] = checked && !isSaved(numbers);
    });
    updateDrawState();
  });

  // 체크한 세트를 한꺼번에 저장
  saveSelectedButton.addEventListener('click', function () {
    var now = Date.now();
    var batch = [];
    var labels = [];

    currentDraw.forEach(function (numbers, rowIndex) {
      if (!selectedRows[rowIndex] || isSaved(numbers)) return;
      batch.push({
        id: now.toString(36) + '-' + rowIndex + '-' + randomInt(1000000).toString(36),
        numbers: numbers.slice(),
        savedAt: now
      });
      labels.push(ROW_LABELS[rowIndex]);
    });
    if (batch.length === 0) return;

    savedSets = batch.concat(savedSets);   // 새로 저장한 묶음이 맨 위, 묶음 안에서는 A→E 순서
    selectedRows = [];
    writeStorage();
    renderSaved(batch.map(function (item) { return item.id; }));
    announce(labels.join(', ') + ' ' + batch.length + '세트를 내 로또 번호에 저장했습니다.');
  });

  // 저장 목록에서 하나 체크 / 해제
  savedList.addEventListener('change', function (event) {
    var check = event.target;
    if (!check.classList || !check.classList.contains('saved-check')) return;

    if (check.checked) selectedSavedIds[check.dataset.id] = true;
    else delete selectedSavedIds[check.dataset.id];
    updateSavedSelection();
  });

  // 저장 목록 모두 선택 / 모두 해제
  selectAllSaved.addEventListener('change', function () {
    selectedSavedIds = {};
    if (selectAllSaved.checked) {
      savedSets.forEach(function (item) { selectedSavedIds[item.id] = true; });
    }
    updateSavedSelection();
  });

  // 체크한 항목을 한꺼번에 삭제
  deleteSelectedButton.addEventListener('click', function () {
    var count = savedSets.filter(function (item) { return selectedSavedIds[item.id]; }).length;
    if (count === 0) return;

    var question = count === savedSets.length
      ? '저장한 번호 ' + count + '세트를 모두 삭제할까요?'
      : '선택한 ' + count + '세트를 삭제할까요?';
    if (!window.confirm(question)) return;

    savedSets = savedSets.filter(function (item) { return !selectedSavedIds[item.id]; });
    selectedSavedIds = {};
    writeStorage();
    renderSaved();
    announce(count + '세트를 삭제했습니다.');
  });

  // 다른 탭에서 저장하거나 삭제하면 이 탭도 따라간다.
  window.addEventListener('storage', function (event) {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    savedSets = readStorage();
    renderSaved();
  });

  /* ---------- 다크 모드 ---------- */

  var THEME_KEY = 'lottoTheme';
  var themeToggle = document.getElementById('themeToggle');
  var systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function savedTheme() {
    try {
      var value = window.localStorage.getItem(THEME_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (error) {
      return null;
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
  }

  themeToggle.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      // 저장소를 못 쓰면 이번 창에서만 적용된다.
    }
    announce(next === 'dark' ? '다크 모드를 켰습니다.' : '다크 모드를 껐습니다.');
  });

  // 직접 고른 적이 없으면 컴퓨터의 밝기 설정이 바뀔 때 따라간다.
  function followSystem(event) {
    if (!savedTheme()) applyTheme(event.matches ? 'dark' : 'light');
  }
  if (systemDark) {
    if (systemDark.addEventListener) systemDark.addEventListener('change', followSystem);
    else if (systemDark.addListener) systemDark.addListener(followSystem);
  }

  // 다른 탭에서 테마를 바꾸면 이 탭도 따라간다.
  window.addEventListener('storage', function (event) {
    if (event.key === THEME_KEY && (event.newValue === 'light' || event.newValue === 'dark')) {
      applyTheme(event.newValue);
    }
  });

  /* ---------- 시작 ---------- */

  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  savedSets = readStorage();
  storageNotice.hidden = storageWorks;
  renderDraw(false);
  renderSaved();
})();

// ============================================================
//  BIBERBANDE – Digital Prototype
// ============================================================

const AI_NAMES = ['Berta Biber', 'Bruno Biber', 'Bella Biber', 'Boris Biber', 'Benni Biber'];
const HUMAN_NAMES = ['Spieler 1', 'Spieler 2', 'Spieler 3', 'Spieler 4', 'Spieler 5', 'Spieler 6'];
const PEEK_DURATION = 2000;

const DIFF_CONFIG = {
  easy:       { aiDelay: 1500, discardMax: 1, swapDrawnMax: 2, swapCardMin: 8, knockMax: 5,  blunderChance: 0.3, peekUseChance: 0.5 },
  medium:     { aiDelay: 1200, discardMax: 3, swapDrawnMax: 3, swapCardMin: 6, knockMax: 8,  blunderChance: 0,   peekUseChance: 1.0 },
  hard:       { aiDelay: 900,  discardMax: 4, swapDrawnMax: 5, swapCardMin: 5, knockMax: 10, blunderChance: 0,   peekUseChance: 1.0 },
  impossible: { aiDelay: 600,  discardMax: 5, swapDrawnMax: 6, swapCardMin: 4, knockMax: 14, blunderChance: 0,   peekUseChance: 1.0 },
};

// ── Card helpers ────────────────────────────────────────────
function createDeck() {
  const deck = [];
  let id = 0;
  // Überbiber: value -999 (1 card) – the legendary card
  deck.push({ id: id++, type: 'number', value: -999 });
  // Goldbiber: value -3 (1 card)
  deck.push({ id: id++, type: 'number', value: -3 });
  // Eisbiber: value -2 (2 cards)
  for (let i = 0; i < 2; i++)
    deck.push({ id: id++, type: 'number', value: -2 });
  // Null-Biber: value -1 (4 cards)
  for (let i = 0; i < 4; i++)
    deck.push({ id: id++, type: 'number', value: -1 });
  for (let v = 0; v <= 8; v++)
    for (let i = 0; i < 4; i++)
      deck.push({ id: id++, type: 'number', value: v });
  for (let i = 0; i < 9; i++)
    deck.push({ id: id++, type: 'number', value: 9 });
  // Fluchbiber: value 999 (1 card) – the cursed card
  deck.push({ id: id++, type: 'number', value: 999 });
  for (let i = 0; i < 7; i++)
    deck.push({ id: id++, type: 'peek', value: null });
  for (let i = 0; i < 9; i++)
    deck.push({ id: id++, type: 'swap', value: null });
  for (let i = 0; i < 5; i++)
    deck.push({ id: id++, type: 'draw_two', value: null });
  // Crazy cards
  for (let i = 0; i < 3; i++)
    deck.push({ id: id++, type: 'chaos', value: null });
  for (let i = 0; i < 3; i++)
    deck.push({ id: id++, type: 'spion', value: null });
  for (let i = 0; i < 2; i++)
    deck.push({ id: id++, type: 'blitz', value: null });
  deck.push({ id: id++, type: 'tornado', value: null });
  for (let i = 0; i < 2; i++)
    deck.push({ id: id++, type: 'freeze', value: null });
  for (let i = 0; i < 2; i++)
    deck.push({ id: id++, type: 'spiegel', value: null });
  for (let i = 0; i < 2; i++)
    deck.push({ id: id++, type: 'dieb', value: null });
  for (let i = 0; i < 2; i++)
    deck.push({ id: id++, type: 'glueckspilz', value: null });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardDisplayName(card) {
  if (card.type === 'number' && card.value === -999) return '−∞';
  if (card.type === 'number' && card.value === 999) return '+∞';
  if (card.type === 'number') return String(card.value);
  if (card.type === 'peek') return 'Spähen';
  if (card.type === 'swap') return 'Tausch';
  if (card.type === 'draw_two') return '2× Ziehen';
  if (card.type === 'chaos') return 'Chaosbiber';
  if (card.type === 'spion') return 'Spion';
  if (card.type === 'blitz') return 'Blitz';
  if (card.type === 'tornado') return 'Tornado';
  if (card.type === 'freeze') return 'Freeze';
  if (card.type === 'spiegel') return 'Spiegel';
  if (card.type === 'dieb') return 'Dieb';
  if (card.type === 'glueckspilz') return 'Glückspilz';
  return '?';
}

function isActionCard(card) {
  return card.type !== 'number';
}

function cardScore(card) {
  return card.type === 'number' ? card.value : 0;
}

// ── Game State ──────────────────────────────────────────────
let G = null; // global game state

function newGame(numPlayers, difficulty, numHumans) {
  difficulty = difficulty || 'medium';
  numHumans = Math.min(numHumans || 1, numPlayers);
  G = {
    numPlayers,
    numHumans,
    difficulty,
    diffCfg: DIFF_CONFIG[difficulty],
    players: [],
    drawPile: [],
    discardPile: [],
    currentPlayer: 0,
    phase: 'initial_peek',
    roundNumber: 1,
    totalRounds: numPlayers,
    knockedBy: -1,
    lastRoundTurnsLeft: -1,
    drawnCard: null,
    drawnFrom: null,
    selectedOwnSlot: -1,
    drawTwoPhase: 0,
    drawTwoMustUse: false,
    initialPeekDone: false,
    humanPeekedSlots: [],
    actionLog: [],
    skipNextPlayer: false,
    initialPeekPlayer: 0,
  };

  for (let i = 0; i < numHumans; i++) {
    G.players.push({
      name: numHumans === 1 ? 'Du' : HUMAN_NAMES[i],
      isHuman: true,
      cards: [],
      known: [false, false, false, false],
      humanPeekedSlots: [],
      totalScore: 0,
      roundScores: [],
    });
  }

  let aiIdx = 0;
  for (let i = numHumans; i < numPlayers; i++) {
    G.players.push({
      name: AI_NAMES[aiIdx++] || `KI ${aiIdx}`,
      isHuman: false,
      cards: [],
      known: [false, false, false, false],
      memory: [null, null, null, null],
      totalScore: 0,
      roundScores: [],
    });
  }

  startRound();
}

// ── Round lifecycle ─────────────────────────────────────────
function startRound() {
  G.drawPile = shuffle(createDeck());
  G.discardPile = [];
  G.knockedBy = -1;
  G.lastRoundTurnsLeft = -1;
  G.drawnCard = null;
  G.currentPlayer = 0;
  G.phase = 'initial_peek';
  G.initialPeekDone = false;
  G.humanPeekedSlots = [];
  G.selectedOwnSlot = -1;
  G.initialPeekPlayer = 0;

  for (const p of G.players) {
    p.cards = [];
    p.known = [false, false, false, false];
    if (p.isHuman) p.humanPeekedSlots = [];
    if (!p.isHuman) p.memory = [null, null, null, null];
    for (let i = 0; i < 4; i++) p.cards.push(G.drawPile.pop());
  }

  G.discardPile.push(G.drawPile.pop());

  // AI players remember their outer cards
  for (const p of G.players) {
    if (!p.isHuman) {
      p.known[0] = true;
      p.known[3] = true;
      p.memory[0] = p.cards[0].type === 'number' ? p.cards[0].value : 99;
      p.memory[3] = p.cards[3].type === 'number' ? p.cards[3].value : 99;
    }
  }

  if (G.numHumans > 1) {
    G.initialPeekPlayer = 0;
    G.currentPlayer = 0;
    showPassDevice(G.players[me()].name, 'Schau dir deine 2 äußeren Karten an!', () => {
      render();
      setMessage(`${G.players[me()].name}: Schau dir deine beiden äußeren Karten an! Klicke auf Karte 1 und Karte 4.`);
      setActions([]);
    });
  } else {
    render();
    setMessage('Schau dir deine beiden äußeren Karten an! Klicke auf Karte 1 und Karte 4.');
    setActions([]);
  }
}

function drawCard() {
  if (G.drawPile.length === 0) {
    const top = G.discardPile.pop();
    G.drawPile = shuffle(G.discardPile);
    G.discardPile = [top];
  }
  return G.drawPile.pop();
}

function discardCard(card) {
  G.discardPile.push(card);
}

function topDiscard() {
  return G.discardPile.length > 0 ? G.discardPile[G.discardPile.length - 1] : null;
}

// ── Multi-human helpers ─────────────────────────────────────
function activeHumanIdx() {
  return G.currentPlayer;
}

function activeHuman() {
  return G.players[G.currentPlayer];
}

function me() {
  if (G.numHumans > 1 && G.players[G.currentPlayer] && G.players[G.currentPlayer].isHuman) return G.currentPlayer;
  return 0;
}

function myPlayer() {
  return G.players[me()];
}

function isOpponent(i) {
  return i !== me();
}

function showPassDevice(playerName, info, callback) {
  const overlay = document.getElementById('pass-device-overlay');
  document.getElementById('pass-device-title').textContent = `📱 ${playerName} ist dran!`;
  document.getElementById('pass-device-message').textContent = info || 'Gib das Gerät weiter.';
  overlay.classList.remove('hidden');
  const btn = document.getElementById('pass-device-btn');
  btn.onclick = () => {
    overlay.classList.add('hidden');
    if (callback) callback();
  };
}

// ── Human interactions ──────────────────────────────────────
function onHumanCardClick(slotIdx) {
  const pi = G.currentPlayer;
  const human = G.players[pi];

  if (G.phase === 'initial_peek') {
    if (slotIdx !== 0 && slotIdx !== 3) return;
    const peeked = human.humanPeekedSlots || G.humanPeekedSlots;
    if (peeked.includes(slotIdx)) return;

    peeked.push(slotIdx);
    if (human.humanPeekedSlots) human.humanPeekedSlots = peeked;
    else G.humanPeekedSlots = peeked;
    human.known[slotIdx] = true;

    showPeekOverlay(human.cards[slotIdx], `Karte ${slotIdx + 1}`);

    if (peeked.length >= 2) {
      G.initialPeekDone = true;
    }
    return;
  }

  if (G.phase === 'drawn' && G.drawnCard && G.drawnCard.type === 'number') {
    performSwap(pi, slotIdx);
    return;
  }

  if (G.phase === 'drawn' && G.drawnCard && G.drawnCard.type === 'peek') {
    performPeek(pi, slotIdx);
    return;
  }

  if (G.phase === 'drawn' && G.drawnCard && G.drawnCard.type === 'swap') {
    G.selectedOwnSlot = slotIdx;
    G.phase = 'select_target';
    setMessage('Wähle jetzt eine Karte eines Mitspielers zum Tauschen.');
    highlightOpponentCards(true);
    render();
    return;
  }

  if (G.phase === 'discard_swap') {
    performSwap(pi, slotIdx);
    return;
  }

  if (G.phase === 'draw_two_1' || G.phase === 'draw_two_2') {
    if (G.drawnCard && G.drawnCard.type === 'number') {
      performSwap(pi, slotIdx);
    } else if (G.drawnCard && G.drawnCard.type === 'peek') {
      performPeek(pi, slotIdx);
    } else if (G.drawnCard && G.drawnCard.type === 'swap') {
      G.selectedOwnSlot = slotIdx;
      G.phase = G.phase === 'draw_two_1' ? 'dt1_select_target' : 'dt2_select_target';
      setMessage('Wähle eine Karte eines Mitspielers zum Tauschen.');
      highlightOpponentCards(true);
      render();
    }
    return;
  }

  if (G.phase === 'spiegel_1') {
    human.known[slotIdx] = true;
    showPeekOverlay(human.cards[slotIdx], `Karte ${slotIdx + 1}`, () => {
      G.phase = 'spiegel_2';
      setMessage('🪞 Spiegel: Wähle deine zweite Karte zum Ansehen.');
      render();
    });
    return;
  }

  if (G.phase === 'spiegel_2') {
    human.known[slotIdx] = true;
    showPeekOverlay(human.cards[slotIdx], `Karte ${slotIdx + 1}`, () => {
      if (G.drawTwoPhase === 1) { startDrawTwoSecond(); return; }
      finishHumanTurn();
    });
    return;
  }

  if (G.phase === 'dieb_swap') {
    const target = G._diebTarget;
    const ownCard = human.cards[slotIdx];
    const targetCard = G.players[target.player].cards[target.slot];
    human.cards[slotIdx] = targetCard;
    G.players[target.player].cards[target.slot] = ownCard;
    human.known[slotIdx] = true;
    if (!G.players[target.player].isHuman) {
      G.players[target.player].known[target.slot] = false;
      G.players[target.player].memory[target.slot] = null;
    } else {
      G.players[target.player].known[target.slot] = false;
    }
    G._diebTarget = null;
    if (G.drawTwoPhase === 1) { startDrawTwoSecond(); return; }
    finishHumanTurn();
    return;
  }

  if (G.phase === 'lucky_swap') {
    performSwap(pi, slotIdx);
    return;
  }
}

function onOpponentCardClick(playerIdx, slotIdx) {
  if (G.phase === 'select_target' || G.phase === 'dt1_select_target' || G.phase === 'dt2_select_target') {
    performPlayerSwap(G.currentPlayer, G.selectedOwnSlot, playerIdx, slotIdx);
    return;
  }
  if (G.phase === 'spion_select') {
    executeSpionPeek(playerIdx, slotIdx);
    return;
  }
  if (G.phase === 'dieb_select') {
    const card = G.players[playerIdx].cards[slotIdx];
    G._diebTarget = { player: playerIdx, slot: slotIdx };
    showPeekOverlay(card, `${G.players[playerIdx].name} – Karte ${slotIdx + 1}`, () => {
      setMessage(`${cardDisplayName(card)} gesehen! Stehlen oder nur ansehen?`);
      setActions([
        { label: '🦝 Stehlen!', class: 'danger', action: () => {
          G.phase = 'dieb_swap';
          setMessage('Wähle deine Karte, die du abgeben willst.');
          setActions([]);
          render();
        }},
        { label: 'Nur ansehen', class: 'secondary', action: () => {
          G._diebTarget = null;
          if (G.drawTwoPhase === 1) { startDrawTwoSecond(); return; }
          finishHumanTurn();
        }},
      ]);
      render();
    });
    return;
  }
}

function onDrawPileClick() {
  if (!G.players[G.currentPlayer].isHuman) return;

  if (G.phase === 'draw') {
    const card = drawCard();
    G.drawnCard = card;
    G.drawnFrom = 'draw';

    if (card.type === 'number') {
      G.phase = 'drawn';
      setMessage(`Du hast eine ${card.value} gezogen. Tausche sie mit einer deiner Karten oder lege sie ab.`);
      setActions([
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
      highlightHumanCards(true);
    } else if (card.type === 'peek') {
      G.phase = 'drawn';
      setMessage('Spähen-Karte! Klicke auf eine deiner Karten, um sie anzusehen. Oder lege die Karte ab.');
      setActions([
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
      highlightHumanCards(true);
    } else if (card.type === 'swap') {
      G.phase = 'drawn';
      setMessage('Tausch-Karte! Wähle eine deiner Karten, dann eine Karte eines Mitspielers. Oder lege ab.');
      setActions([
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
      highlightHumanCards(true);
    } else if (card.type === 'draw_two') {
      G.phase = 'drawn';
      setMessage('2× Ziehen! Du ziehst gleich zwei Karten vom Stapel.');
      setActions([
        { label: 'Aktion ausführen', class: 'primary', action: () => humanDrawTwo() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'chaos') {
      G.phase = 'drawn';
      setMessage('🌀 Chaosbiber! Eine zufällige Karte jedes Spielers wird wild durchgemischt!');
      setActions([
        { label: 'Chaos auslösen!', class: 'danger', action: () => humanExecuteChaos() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'spion') {
      G.phase = 'drawn';
      setMessage('🕵️ Spion! Schau dir eine Karte eines Mitspielers an.');
      setActions([
        { label: 'Spionieren', class: 'primary', action: () => humanStartSpion() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'blitz') {
      G.phase = 'drawn';
      setMessage('⚡ Blitz! Alle Spieler schieben ihre erste Karte nach links weiter!');
      setActions([
        { label: 'Blitz auslösen!', class: 'danger', action: () => humanExecuteBlitz() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'tornado') {
      G.phase = 'drawn';
      setMessage('🌪️ Tornado! ALLE Karten aller Spieler werden komplett neu verteilt!');
      setActions([
        { label: 'Tornado auslösen!', class: 'danger', action: () => humanExecuteTornado() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'freeze') {
      G.phase = 'drawn';
      setMessage('❄️ Freeze! Der nächste Spieler wird übersprungen!');
      setActions([
        { label: 'Einfrieren!', class: 'primary', action: () => humanExecuteFreeze() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'spiegel') {
      G.phase = 'drawn';
      setMessage('🪞 Spiegel! Du darfst 2 deiner Karten ansehen!');
      setActions([
        { label: 'Spiegeln!', class: 'primary', action: () => humanStartSpiegel() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'dieb') {
      G.phase = 'drawn';
      setMessage('🦝 Dieb! Schau dir eine Karte eines Gegners an und stiehl sie optional!');
      setActions([
        { label: 'Stehlen gehen!', class: 'danger', action: () => humanStartDieb() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    } else if (card.type === 'glueckspilz') {
      G.phase = 'drawn';
      setMessage('🍀 Glückspilz! Ziehe 3 Karten und behalte die beste!');
      setActions([
        { label: 'Glück versuchen!', class: 'primary', action: () => humanStartGlueckspilz() },
        { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
      ]);
    }

    render();
    return;
  }
}

function onDiscardPileClick() {
  if (!G.players[G.currentPlayer].isHuman) return;
  if (G.phase !== 'draw') return;

  const top = topDiscard();
  if (!top || top.type !== 'number') return;

  G.drawnCard = G.discardPile.pop();
  G.drawnFrom = 'discard';
  G.phase = 'discard_swap';
  setMessage(`Du nimmst die ${G.drawnCard.value} vom Ablagestapel. Tausche sie mit einer deiner Karten.`);
  setActions([]);
  highlightHumanCards(true);
  render();
}

function humanDiscard() {
  if (!G.drawnCard) return;
  discardCard(G.drawnCard);
  G.drawnCard = null;
  highlightHumanCards(false);

  if (G.phase === 'draw_two_1') {
    startDrawTwoSecond();
    return;
  }

  finishHumanTurn();
}

function humanDrawTwo() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  G.drawTwoPhase = 1;

  const card1 = drawCard();
  G.drawnCard = card1;
  G.phase = 'draw_two_1';

  showDrawTwoCard(card1, false);
}

function startDrawTwoSecond() {
  const card2 = drawCard();
  G.drawnCard = card2;
  G.phase = 'draw_two_2';
  G.drawTwoMustUse = true;

  showDrawTwoCard(card2, true);
}

function showDrawTwoCard(card, mustUse) {
  const label = mustUse ? 'Zweite Karte (muss genutzt werden)' : 'Erste Karte';

  if (card.type === 'number') {
    setMessage(`${label}: ${card.value}. ${mustUse ? 'Du musst sie mit einer Karte tauschen.' : 'Tausche oder lege ab.'}`);
    const actions = mustUse ? [] : [{ label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
    highlightHumanCards(true);
  } else if (card.type === 'peek') {
    setMessage(`${label}: Spähen! Klicke auf eine deiner Karten.${mustUse ? '' : ' Oder lege ab.'}`);
    const actions = mustUse ? [] : [{ label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
    highlightHumanCards(true);
  } else if (card.type === 'swap') {
    setMessage(`${label}: Tausch! Wähle deine Karte, dann eine des Gegners.${mustUse ? '' : ' Oder lege ab.'}`);
    const actions = mustUse ? [] : [{ label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
    highlightHumanCards(true);
  } else if (card.type === 'draw_two') {
    if (mustUse) {
      setMessage(`${label}: Nochmal 2× Ziehen! Wird als einfaches Ziehen ausgeführt.`);
      discardCard(card);
      const extra = drawCard();
      G.drawnCard = extra;
      showDrawTwoCard(extra, true);
      return;
    }
    setMessage(`${label}: 2× Ziehen. Lege ab oder führe die Aktion aus.`);
    setActions([
      { label: 'Aktion ausführen', class: 'primary', action: () => { discardCard(card); G.drawnCard = null; humanDrawTwo(); } },
      { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() },
    ]);
  } else if (card.type === 'chaos') {
    setMessage(`${label}: 🌀 Chaosbiber!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Chaos auslösen!', class: 'danger', action: () => humanExecuteChaos() }]
      : [{ label: 'Chaos auslösen!', class: 'danger', action: () => humanExecuteChaos() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  } else if (card.type === 'spion') {
    setMessage(`${label}: 🕵️ Spion!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Spionieren', class: 'primary', action: () => humanStartSpion() }]
      : [{ label: 'Spionieren', class: 'primary', action: () => humanStartSpion() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  } else if (card.type === 'blitz') {
    setMessage(`${label}: ⚡ Blitz!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Blitz auslösen!', class: 'danger', action: () => humanExecuteBlitz() }]
      : [{ label: 'Blitz auslösen!', class: 'danger', action: () => humanExecuteBlitz() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  } else if (card.type === 'tornado') {
    setMessage(`${label}: 🌪️ Tornado!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Tornado!', class: 'danger', action: () => humanExecuteTornado() }]
      : [{ label: 'Tornado!', class: 'danger', action: () => humanExecuteTornado() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  } else if (card.type === 'freeze') {
    setMessage(`${label}: ❄️ Freeze!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Einfrieren!', class: 'primary', action: () => humanExecuteFreeze() }]
      : [{ label: 'Einfrieren!', class: 'primary', action: () => humanExecuteFreeze() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  } else if (card.type === 'spiegel') {
    setMessage(`${label}: 🪞 Spiegel!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Spiegeln!', class: 'primary', action: () => humanStartSpiegel() }]
      : [{ label: 'Spiegeln!', class: 'primary', action: () => humanStartSpiegel() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  } else if (card.type === 'dieb') {
    setMessage(`${label}: 🦝 Dieb!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Stehlen!', class: 'danger', action: () => humanStartDieb() }]
      : [{ label: 'Stehlen!', class: 'danger', action: () => humanStartDieb() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  } else if (card.type === 'glueckspilz') {
    setMessage(`${label}: 🍀 Glückspilz!${mustUse ? ' Muss gespielt werden!' : ''}`);
    const actions = mustUse
      ? [{ label: 'Glück!', class: 'primary', action: () => humanStartGlueckspilz() }]
      : [{ label: 'Glück!', class: 'primary', action: () => humanStartGlueckspilz() },
         { label: 'Ablegen', class: 'secondary', action: () => humanDiscard() }];
    setActions(actions);
  }

  render();
}

function performSwap(playerIdx, slotIdx) {
  const player = G.players[playerIdx];
  const oldCard = player.cards[slotIdx];
  player.cards[slotIdx] = G.drawnCard;

  player.known[slotIdx] = true;
  if (!player.isHuman && player.memory) {
    player.memory[slotIdx] = G.drawnCard.type === 'number' ? G.drawnCard.value : 99;
  }

  discardCard(oldCard);
  G.drawnCard = null;
  highlightHumanCards(false);

  if (G.phase === 'draw_two_1') {
    startDrawTwoSecond();
    return;
  }

  if (player.isHuman) finishHumanTurn();
}

function performPeek(playerIdx, slotIdx) {
  const player = G.players[playerIdx];
  const card = player.cards[slotIdx];
  player.known[slotIdx] = true;

  if (!player.isHuman) {
    player.memory[slotIdx] = card.type === 'number' ? card.value : 99;
  }

  discardCard(G.drawnCard);
  G.drawnCard = null;
  highlightHumanCards(false);

  if (player.isHuman) {
    showPeekOverlay(card, `Karte ${slotIdx + 1}`, () => {
      if (G.phase === 'draw_two_1') {
        startDrawTwoSecond();
        return;
      }
      finishHumanTurn();
    });
  } else {
    if (G.phase === 'draw_two_1') {
      startDrawTwoSecond();
      return;
    }
  }
}

function performPlayerSwap(playerIdx, ownSlot, targetPlayerIdx, targetSlot) {
  const ownPlayer = G.players[playerIdx];
  const targetPlayer = G.players[targetPlayerIdx];

  const ownCard = ownPlayer.cards[ownSlot];
  const targetCard = targetPlayer.cards[targetSlot];

  ownPlayer.cards[ownSlot] = targetCard;
  targetPlayer.cards[targetSlot] = ownCard;

  ownPlayer.known[ownSlot] = false;
  targetPlayer.known[targetSlot] = false;

  if (!ownPlayer.isHuman) {
    ownPlayer.memory[ownSlot] = null;
  }
  if (!targetPlayer.isHuman) {
    targetPlayer.memory[targetSlot] = null;
  }

  discardCard(G.drawnCard);
  G.drawnCard = null;
  G.selectedOwnSlot = -1;
  highlightOpponentCards(false);
  highlightHumanCards(false);

  const wasPhase = G.phase;
  if (wasPhase === 'dt1_select_target') {
    G.phase = 'draw_two_1';
    startDrawTwoSecond();
    return;
  }
  if (wasPhase === 'dt2_select_target') {
    G.phase = 'draw_two_2';
    if (ownPlayer.isHuman) finishHumanTurn();
    return;
  }

  if (ownPlayer.isHuman) finishHumanTurn();
}

// ── Crazy card execution ────────────────────────────────────
function executeChaosbiber() {
  const slots = [];
  const cards = [];
  for (let i = 0; i < G.numPlayers; i++) {
    const slot = Math.floor(Math.random() * 4);
    slots.push(slot);
    cards.push(G.players[i].cards[slot]);
  }
  shuffle(cards);
  for (let i = 0; i < G.numPlayers; i++) {
    G.players[i].cards[slots[i]] = cards[i];
    G.players[i].known[slots[i]] = false;
    if (!G.players[i].isHuman && G.players[i].memory) {
      G.players[i].memory[slots[i]] = null;
    }
  }
}

function executeBlitz() {
  const saved = G.players[G.numPlayers - 1].cards[0];
  const savedKnown = G.players[G.numPlayers - 1].known[0];
  for (let i = G.numPlayers - 1; i > 0; i--) {
    G.players[i].cards[0] = G.players[i - 1].cards[0];
    G.players[i].known[0] = false;
    if (!G.players[i].isHuman && G.players[i].memory)
      G.players[i].memory[0] = null;
  }
  G.players[0].cards[0] = saved;
  G.players[0].known[0] = false;
}

function humanExecuteChaos() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  executeChaosbiber();
  setMessage('🌀 Chaos! Die Karten wurden wild durchgemischt!');
  setActions([]);
  render();
  if (G.phase === 'draw_two_1') { setTimeout(() => startDrawTwoSecond(), 1200); return; }
  setTimeout(() => finishHumanTurn(), 1200);
}

function humanExecuteBlitz() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  executeBlitz();
  setMessage('⚡ Blitz! Alle ersten Karten wurden nach links geschoben!');
  setActions([]);
  render();
  if (G.phase === 'draw_two_1') { setTimeout(() => startDrawTwoSecond(), 1200); return; }
  setTimeout(() => finishHumanTurn(), 1200);
}

function humanStartSpion() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  G.phase = 'spion_select';
  setMessage('🕵️ Wähle eine Karte eines Mitspielers zum Ansehen.');
  setActions([]);
  render();
}

function executeSpionPeek(playerIdx, slotIdx) {
  const card = G.players[playerIdx].cards[slotIdx];
  G.phase = 'drawn'; // temp phase so overlay works
  showPeekOverlay(card, `${G.players[playerIdx].name} – Karte ${slotIdx + 1}`, () => {
    if (G.drawTwoPhase === 1) {
      G.phase = 'draw_two_1';
      startDrawTwoSecond();
      return;
    }
    finishHumanTurn();
  });
}

function executeTornado() {
  const allCards = [];
  for (const p of G.players) {
    for (let i = 0; i < 4; i++) allCards.push(p.cards[i]);
  }
  shuffle(allCards);
  let idx = 0;
  for (const p of G.players) {
    for (let i = 0; i < 4; i++) {
      p.cards[i] = allCards[idx++];
      p.known[i] = false;
      if (p.memory) p.memory[i] = null;
    }
  }
  G.humanPeekedSlots = [];
}

function humanExecuteTornado() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  executeTornado();
  setMessage('🌪️ Tornado! Alle Karten wurden wild neu verteilt!');
  setActions([]);
  render();
  if (G.phase === 'draw_two_1') { setTimeout(() => startDrawTwoSecond(), 1200); return; }
  setTimeout(() => finishHumanTurn(), 1200);
}

function humanExecuteFreeze() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  G.skipNextPlayer = true;
  setMessage('❄️ Freeze! Der nächste Spieler wird übersprungen!');
  setActions([]);
  render();
  if (G.phase === 'draw_two_1') { setTimeout(() => startDrawTwoSecond(), 1200); return; }
  setTimeout(() => finishHumanTurn(), 1200);
}

function humanStartSpiegel() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  G.phase = 'spiegel_1';
  setMessage('🪞 Spiegel: Wähle deine erste Karte zum Ansehen.');
  setActions([]);
  render();
}

function humanStartDieb() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  G.phase = 'dieb_select';
  setMessage('🦝 Dieb: Wähle eine Karte eines Gegners zum Ansehen.');
  setActions([]);
  render();
}

function humanStartGlueckspilz() {
  discardCard(G.drawnCard);
  G.drawnCard = null;
  const cards = [];
  for (let i = 0; i < 3; i++) cards.push(drawCard());
  G._luckyCards = cards;
  G.phase = 'lucky_pick';

  render();
  setMessage('🍀 Glückspilz! Wähle eine der 3 Karten:');

  const container = document.getElementById('action-buttons');
  container.innerHTML = '';
  cards.forEach((card, i) => {
    const btn = document.createElement('button');
    btn.className = 'action-btn lucky-card-btn';
    const name = cardDisplayName(card);
    btn.textContent = card.type === 'number' ? `${name} Punkte` : name;
    btn.addEventListener('click', () => pickLuckyCard(i));
    container.appendChild(btn);
  });

  const discardBtn = document.createElement('button');
  discardBtn.className = 'action-btn secondary';
  discardBtn.textContent = 'Alle ablegen';
  discardBtn.addEventListener('click', () => {
    G._luckyCards.forEach(c => discardCard(c));
    G._luckyCards = null;
    G.phase = 'drawn';
    if (G.drawTwoPhase === 1) { startDrawTwoSecond(); return; }
    finishHumanTurn();
  });
  container.appendChild(discardBtn);
}

function pickLuckyCard(idx) {
  const card = G._luckyCards[idx];
  G._luckyCards.forEach((c, i) => { if (i !== idx) discardCard(c); });
  G._luckyCards = null;

  if (card.type === 'number') {
    G.drawnCard = card;
    G.phase = 'lucky_swap';
    setMessage(`Du hast ${card.value} gewählt! Tausche mit einer deiner Karten oder lege ab.`);
    setActions([{ label: 'Ablegen', class: 'secondary', action: () => {
      discardCard(G.drawnCard);
      G.drawnCard = null;
      if (G.drawTwoPhase === 1) { startDrawTwoSecond(); return; }
      finishHumanTurn();
    }}]);
    render();
  } else {
    discardCard(card);
    if (G.drawTwoPhase === 1) { startDrawTwoSecond(); return; }
    finishHumanTurn();
  }
}

function finishHumanTurn() {
  G.drawnCard = null;
  G.drawTwoPhase = 0;
  G.drawTwoMustUse = false;

  if (G.knockedBy >= 0) {
    if (checkLastRoundEnd()) return;
    advanceTurn();
    return;
  }

  G.phase = 'knock_check';
  setMessage('Möchtest du klopfen und die letzte Runde einläuten?');
  setActions([
    { label: 'Klopfen!', class: 'knock', action: () => humanKnock() },
    { label: 'Weiter', class: 'secondary', action: () => advanceTurn() },
  ]);
  render();
}

function humanKnock() {
  G.knockedBy = G.currentPlayer;
  G.lastRoundTurnsLeft = G.numPlayers - 1;
  const name = G.numHumans > 1 ? G.players[G.currentPlayer].name : 'Du';
  setMessage(`${name} hat geklopft! Letzte Runde!`);
  setActions([]);
  render();
  setTimeout(() => advanceTurn(), G.diffCfg.aiDelay);
}

// ── Turn management ─────────────────────────────────────────
function checkLastRoundEnd() {
  if (G.knockedBy >= 0) {
    G.lastRoundTurnsLeft--;
    if (G.lastRoundTurnsLeft <= 0) {
      endRound();
      return true;
    }
  }
  return false;
}

function advanceTurn() {
  G.currentPlayer = (G.currentPlayer + 1) % G.numPlayers;

  if (G.skipNextPlayer) {
    G.skipNextPlayer = false;
    const skippedName = G.players[G.currentPlayer].name;
    setMessage(`${skippedName} ist eingefroren! ❄️`);
    render();
    if (G.knockedBy >= 0) {
      G.lastRoundTurnsLeft--;
      if (G.lastRoundTurnsLeft <= 0) {
        setTimeout(() => endRound(), 800);
        return;
      }
    }
    setTimeout(() => {
      G.currentPlayer = (G.currentPlayer + 1) % G.numPlayers;
      G.phase = 'draw';
      G.drawnCard = null;
      G.selectedOwnSlot = -1;
      render();
      if (G.players[G.currentPlayer].isHuman) {
        startHumanTurn();
      } else {
        startAITurn(G.currentPlayer);
      }
    }, 800);
    return;
  }

  G.phase = 'draw';
  G.drawnCard = null;
  G.selectedOwnSlot = -1;

  render();

  if (G.players[G.currentPlayer].isHuman) {
    startHumanTurn();
  } else {
    startAITurn(G.currentPlayer);
  }
}

function startHumanTurn() {
  if (autoPlay) {
    autoPlayHumanTurn();
    return;
  }
  const p = G.players[G.currentPlayer];
  const name = G.numHumans > 1 ? p.name + ': ' : '';

  if (G.numHumans > 1 && !G._skipPassDevice) {
    showPassDevice(p.name, 'Du bist dran!', () => {
      const discardOK = topDiscard() && topDiscard().type === 'number';
      setMessage(`${name}Ziehe eine Karte vom Nachzieh- oder Ablagestapel.`);
      setActions([]);
      render();
    });
    return;
  }
  G._skipPassDevice = false;

  const discardOK = topDiscard() && topDiscard().type === 'number';
  setMessage(`${name}Ziehe eine Karte vom Nachzieh- oder Ablagestapel.`);
  setActions([]);
  render();
}

async function autoPlayHumanTurn() {
  const human = G.players[G.currentPlayer];
  setMessage(`🤖 Auto-Play: ${human.name} denkt nach…`);
  showAIThinking(true);
  render();
  await delay(G.diffCfg.aiDelay);

  const discard = topDiscard();
  if (discard && discard.type === 'number' && discard.value <= 2) {
    G.drawnCard = G.discardPile.pop();
    G.drawnFrom = 'discard';
    const slot = autoPlayBestSlot(human, G.drawnCard.value);
    const old = human.cards[slot];
    human.cards[slot] = G.drawnCard;
    human.known[slot] = true;
    discardCard(old);
    G.drawnCard = null;
  } else {
    const card = drawCard();
    G.drawnCard = card;
    G.drawnFrom = 'draw';

    if (card.type === 'number' && card.value <= 4) {
      const slot = autoPlayBestSlot(human, card.value);
      const old = human.cards[slot];
      human.cards[slot] = card;
      human.known[slot] = true;
      discardCard(old);
      G.drawnCard = null;
    } else if (card.type === 'number') {
      discardCard(card);
      G.drawnCard = null;
    } else {
      discardCard(card);
      G.drawnCard = null;
    }
  }

  showAIThinking(false);

  if (G.knockedBy >= 0) {
    if (checkLastRoundEnd()) return;
    advanceTurn();
    return;
  }

  let knownSum = 0, knownCount = 0;
  for (let i = 0; i < 4; i++) {
    if (human.known[i]) {
      knownSum += human.cards[i].type === 'number' ? human.cards[i].value : 99;
      knownCount++;
    }
  }
  if (knownCount === 4 && knownSum <= 6) {
    G.knockedBy = G.currentPlayer;
    G.lastRoundTurnsLeft = G.numPlayers - 1;
    setMessage('🤖 Auto-Play: Du klopfst!');
    render();
    await delay(G.diffCfg.aiDelay);
  }

  advanceTurn();
}

function autoPlayBestSlot(player, newValue) {
  let worstSlot = 0, worstVal = -99;
  for (let i = 0; i < 4; i++) {
    if (player.known[i]) {
      const v = player.cards[i].type === 'number' ? player.cards[i].value : 99;
      if (v > worstVal) { worstVal = v; worstSlot = i; }
    }
  }
  if (worstVal > newValue) return worstSlot;
  for (let i = 0; i < 4; i++) {
    if (!player.known[i]) return i;
  }
  return worstSlot;
}

// ── Initial peek close → start game ─────────────────────────
function onPeekClose() {
  document.getElementById('peek-overlay').classList.add('hidden');

  if (G.phase === 'initial_peek') {
    if (G.initialPeekDone) {
      if (G.numHumans > 1) {
        const nextPeekPlayer = G.initialPeekPlayer + 1;
        if (nextPeekPlayer < G.numHumans) {
          G.initialPeekPlayer = nextPeekPlayer;
          G.initialPeekDone = false;
          G.currentPlayer = nextPeekPlayer;
          showPassDevice(G.players[nextPeekPlayer].name, 'Schau dir deine 2 äußeren Karten an!', () => {
            render();
            setMessage(`${G.players[nextPeekPlayer].name}: Schau dir deine beiden äußeren Karten an!`);
            setActions([]);
          });
        } else {
          G.currentPlayer = 0;
          G.phase = 'draw';
          showPassDevice(G.players[me()].name, 'Das Spiel beginnt!', () => {
            render();
            startHumanTurn();
          });
        }
      } else {
        G.phase = 'draw';
        render();
        startHumanTurn();
      }
    } else {
      render();
      setMessage(G.numHumans > 1 ? `${G.players[G.currentPlayer].name}: Schau dir noch die andere äußere Karte an!` : 'Schau dir noch die andere äußere Karte an!');
    }
  }
}

function onPeekCloseCallback() {
  document.getElementById('peek-overlay').classList.add('hidden');
  if (G._peekCallback) {
    const cb = G._peekCallback;
    G._peekCallback = null;
    cb();
  }
}

// ── AI Logic ────────────────────────────────────────────────
async function startAITurn(playerIdx) {
  const player = G.players[playerIdx];
  setMessage(`${player.name} denkt nach…`);
  showAIThinking(true);
  render();

  await delay(G.diffCfg.aiDelay);

  // Blunder: easy AI sometimes makes random suboptimal decisions
  const blunder = Math.random() < G.diffCfg.blunderChance;

  const discard = topDiscard();
  const discardIsNumber = discard && discard.type === 'number';

  let takeDiscard = false;
  if (!blunder && discardIsNumber && discard.value <= G.diffCfg.discardMax) {
    const highSlot = aiHighestKnownSlot(player);
    if (highSlot >= 0 && player.memory[highSlot] > discard.value) {
      takeDiscard = true;
    }
    const unknownSlot = aiFirstUnknownSlot(player);
    if (!takeDiscard && unknownSlot >= 0 && discard.value <= 2) {
      takeDiscard = true;
    }
  }

  if (takeDiscard) {
    G.drawnCard = G.discardPile.pop();
    G.drawnFrom = 'discard';
    const slot = aiBestSlotForValue(player, G.drawnCard.value);
    logAI(player.name, `nimmt ${G.drawnCard.value} vom Ablagestapel`);
    await delay(600);
    aiSwapCard(playerIdx, slot);
  } else {
    const card = drawCard();
    G.drawnCard = card;
    G.drawnFrom = 'draw';

    if (card.type === 'number') {
      await aiHandleNumberCard(playerIdx, card, false);
    } else if (card.type === 'peek') {
      await aiHandlePeekCard(playerIdx, false);
    } else if (card.type === 'swap') {
      await aiHandleSwapCard(playerIdx, false);
    } else if (card.type === 'draw_two') {
      await aiHandleDrawTwo(playerIdx);
    } else if (card.type === 'chaos') {
      await aiHandleCrazyChaos(playerIdx, false);
    } else if (card.type === 'spion') {
      await aiHandleCrazySpion(playerIdx, false);
    } else if (card.type === 'blitz') {
      await aiHandleCrazyBlitz(playerIdx, false);
    } else if (card.type === 'tornado') {
      await aiHandleTornado(playerIdx, false);
    } else if (card.type === 'freeze') {
      await aiHandleFreeze(playerIdx, false);
    } else if (card.type === 'spiegel') {
      await aiHandleSpiegel(playerIdx, false);
    } else if (card.type === 'dieb') {
      await aiHandleDieb(playerIdx, false);
    } else if (card.type === 'glueckspilz') {
      await aiHandleGlueckspilz(playerIdx, false);
    }
  }

  showAIThinking(false);

  if (G.phase === 'round_end' || G.phase === 'game_over') return;

  if (G.knockedBy >= 0) {
    if (checkLastRoundEnd()) return;
    advanceTurn();
    return;
  }

  // AI knock decision
  if (aiShouldKnock(player)) {
    G.knockedBy = playerIdx;
    G.lastRoundTurnsLeft = G.numPlayers - 1;
    setMessage(`${player.name} klopft! Letzte Runde!`);
    render();
    await delay(G.diffCfg.aiDelay);
  }

  advanceTurn();
}

async function aiHandleNumberCard(playerIdx, card, mustUse) {
  const player = G.players[playerIdx];
  const cfg = G.diffCfg;
  const highSlot = aiHighestKnownSlot(player);
  const unknownSlot = aiFirstUnknownSlot(player);

  let doSwap = false;
  let slot = -1;

  if (highSlot >= 0 && player.memory[highSlot] > card.value) {
    doSwap = true;
    slot = highSlot;
  } else if (card.value <= cfg.swapDrawnMax && unknownSlot >= 0) {
    doSwap = true;
    slot = unknownSlot;
  } else if (mustUse) {
    slot = unknownSlot >= 0 ? unknownSlot : Math.floor(Math.random() * 4);
    doSwap = true;
  }

  if (doSwap && slot >= 0) {
    logAI(player.name, `tauscht eine Karte`);
    await delay(600);
    aiSwapCard(playerIdx, slot);
  } else {
    logAI(player.name, `legt eine Karte ab`);
    discardCard(card);
    G.drawnCard = null;
  }
}

async function aiHandlePeekCard(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  const unknownSlot = aiFirstUnknownSlot(player);

  if (unknownSlot >= 0 && Math.random() < G.diffCfg.peekUseChance) {
    logAI(player.name, `späht eine Karte`);
    player.known[unknownSlot] = true;
    player.memory[unknownSlot] = player.cards[unknownSlot].type === 'number' ? player.cards[unknownSlot].value : 99;
    discardCard(G.drawnCard);
    G.drawnCard = null;
    await delay(600);
  } else if (mustUse) {
    const slot = Math.floor(Math.random() * 4);
    player.known[slot] = true;
    player.memory[slot] = player.cards[slot].type === 'number' ? player.cards[slot].value : 99;
    discardCard(G.drawnCard);
    G.drawnCard = null;
  } else {
    logAI(player.name, `legt Spähen ab`);
    discardCard(G.drawnCard);
    G.drawnCard = null;
  }
}

async function aiHandleSwapCard(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  const highSlot = aiHighestKnownSlot(player);

  if (highSlot >= 0 && player.memory[highSlot] >= G.diffCfg.swapCardMin) {
    const targetInfo = aiRandomOpponentSlot(playerIdx);
    if (targetInfo) {
      logAI(player.name, `tauscht mit ${G.players[targetInfo.player].name}`);
      const ownCard = player.cards[highSlot];
      const targetCard = G.players[targetInfo.player].cards[targetInfo.slot];
      player.cards[highSlot] = targetCard;
      G.players[targetInfo.player].cards[targetInfo.slot] = ownCard;
      player.known[highSlot] = false;
      player.memory[highSlot] = null;
      if (!G.players[targetInfo.player].isHuman) {
        G.players[targetInfo.player].known[targetInfo.slot] = false;
        G.players[targetInfo.player].memory[targetInfo.slot] = null;
      } else {
        G.players[targetInfo.player].known[targetInfo.slot] = false;
      }
      discardCard(G.drawnCard);
      G.drawnCard = null;
      await delay(600);
      render();
      return;
    }
  }

  if (mustUse) {
    const ownSlot = highSlot >= 0 ? highSlot : Math.floor(Math.random() * 4);
    const targetInfo = aiRandomOpponentSlot(playerIdx);
    if (targetInfo) {
      const ownCard = player.cards[ownSlot];
      const targetCard = G.players[targetInfo.player].cards[targetInfo.slot];
      player.cards[ownSlot] = targetCard;
      G.players[targetInfo.player].cards[targetInfo.slot] = ownCard;
      player.known[ownSlot] = false;
      player.memory[ownSlot] = null;
      if (!G.players[targetInfo.player].isHuman) {
        G.players[targetInfo.player].known[targetInfo.slot] = false;
        G.players[targetInfo.player].memory[targetInfo.slot] = null;
      } else {
        G.players[targetInfo.player].known[targetInfo.slot] = false;
      }
    }
    discardCard(G.drawnCard);
    G.drawnCard = null;
    return;
  }

  logAI(player.name, `legt Tausch ab`);
  discardCard(G.drawnCard);
  G.drawnCard = null;
}

async function aiHandleDrawTwo(playerIdx) {
  const player = G.players[playerIdx];
  logAI(player.name, `spielt 2× Ziehen`);
  discardCard(G.drawnCard);
  G.drawnCard = null;

  await delay(600);

  // First card
  const card1 = drawCard();
  G.drawnCard = card1;
  await aiHandleAnyCard(playerIdx, card1, false);

  await delay(600);

  // Second card (must use)
  const card2 = drawCard();
  G.drawnCard = card2;
  await aiHandleAnyCard(playerIdx, card2, true);
}

async function aiHandleAnyCard(playerIdx, card, mustUse) {
  if (card.type === 'number') {
    await aiHandleNumberCard(playerIdx, card, mustUse);
  } else if (card.type === 'peek') {
    await aiHandlePeekCard(playerIdx, mustUse);
  } else if (card.type === 'swap') {
    await aiHandleSwapCard(playerIdx, mustUse);
  } else if (card.type === 'chaos') {
    await aiHandleCrazyChaos(playerIdx, mustUse);
  } else if (card.type === 'spion') {
    await aiHandleCrazySpion(playerIdx, mustUse);
  } else if (card.type === 'blitz') {
    await aiHandleCrazyBlitz(playerIdx, mustUse);
  } else if (card.type === 'tornado') {
    await aiHandleTornado(playerIdx, mustUse);
  } else if (card.type === 'freeze') {
    await aiHandleFreeze(playerIdx, mustUse);
  } else if (card.type === 'spiegel') {
    await aiHandleSpiegel(playerIdx, mustUse);
  } else if (card.type === 'dieb') {
    await aiHandleDieb(playerIdx, mustUse);
  } else if (card.type === 'glueckspilz') {
    await aiHandleGlueckspilz(playerIdx, mustUse);
  } else if (card.type === 'draw_two') {
    if (mustUse) {
      discardCard(card);
      G.drawnCard = null;
      const extra = drawCard();
      G.drawnCard = extra;
      await aiHandleAnyCard(playerIdx, extra, true);
    } else {
      discardCard(card);
      G.drawnCard = null;
    }
  }
}

async function aiHandleCrazyChaos(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  const highSlot = aiHighestKnownSlot(player);
  if (mustUse || (highSlot >= 0 && player.memory[highSlot] >= 7)) {
    logAI(player.name, `löst Chaosbiber aus!`);
    discardCard(G.drawnCard);
    G.drawnCard = null;
    executeChaosbiber();
    await delay(600);
  } else {
    logAI(player.name, `legt Chaosbiber ab`);
    discardCard(G.drawnCard);
    G.drawnCard = null;
  }
}

async function aiHandleCrazySpion(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  if (mustUse || G.difficulty === 'hard' || G.difficulty === 'impossible') {
    logAI(player.name, `spioniert`);
    discardCard(G.drawnCard);
    G.drawnCard = null;
    const targetInfo = aiRandomOpponentSlot(playerIdx);
    if (targetInfo) {
      const targetCard = G.players[targetInfo.player].cards[targetInfo.slot];
      if (G.difficulty === 'impossible') {
        player._opponentKnowledge = player._opponentKnowledge || {};
        player._opponentKnowledge[`${targetInfo.player}_${targetInfo.slot}`] =
          targetCard.type === 'number' ? targetCard.value : 99;
      }
    }
    await delay(600);
  } else {
    logAI(player.name, `legt Spion ab`);
    discardCard(G.drawnCard);
    G.drawnCard = null;
  }
}

async function aiHandleCrazyBlitz(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  const knownAtZero = player.known[0] && player.memory[0] !== null;
  if (mustUse || (knownAtZero && player.memory[0] >= 7)) {
    logAI(player.name, `löst Blitz aus!`);
    discardCard(G.drawnCard);
    G.drawnCard = null;
    executeBlitz();
    await delay(600);
  } else {
    logAI(player.name, `legt Blitz ab`);
    discardCard(G.drawnCard);
    G.drawnCard = null;
  }
}

async function aiHandleTornado(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  const highSlot = aiHighestKnownSlot(player);
  const unknownCount = player.known.filter(k => !k).length;
  if (mustUse || unknownCount >= 3 || (highSlot >= 0 && player.memory[highSlot] >= 8)) {
    logAI(player.name, 'löst Tornado aus! 🌪️');
    discardCard(G.drawnCard);
    G.drawnCard = null;
    executeTornado();
    await delay(600);
  } else {
    logAI(player.name, 'legt Tornado ab');
    discardCard(G.drawnCard);
    G.drawnCard = null;
  }
}

async function aiHandleFreeze(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  logAI(player.name, 'spielt Freeze! ❄️');
  discardCard(G.drawnCard);
  G.drawnCard = null;
  G.skipNextPlayer = true;
  await delay(600);
}

async function aiHandleSpiegel(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  const unknowns = [];
  for (let i = 0; i < 4; i++) {
    if (!player.known[i]) unknowns.push(i);
  }
  if (unknowns.length >= 1 || mustUse) {
    logAI(player.name, 'nutzt Spiegel 🪞');
    discardCard(G.drawnCard);
    G.drawnCard = null;
    const toReveal = shuffle([...unknowns]).slice(0, 2);
    for (const slot of toReveal) {
      player.known[slot] = true;
      player.memory[slot] = player.cards[slot].type === 'number' ? player.cards[slot].value : 99;
    }
    await delay(600);
  } else {
    logAI(player.name, 'legt Spiegel ab');
    discardCard(G.drawnCard);
    G.drawnCard = null;
  }
}

async function aiHandleDieb(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  const targetInfo = aiRandomOpponentSlot(playerIdx);
  if (!targetInfo) {
    discardCard(G.drawnCard);
    G.drawnCard = null;
    return;
  }

  logAI(player.name, 'setzt Dieb ein! 🦝');
  discardCard(G.drawnCard);
  G.drawnCard = null;

  const targetCard = G.players[targetInfo.player].cards[targetInfo.slot];
  const targetValue = targetCard.type === 'number' ? targetCard.value : 99;

  const highSlot = aiHighestKnownSlot(player);
  if (targetValue <= 3 || (highSlot >= 0 && player.memory[highSlot] > targetValue)) {
    const swapSlot = highSlot >= 0 ? highSlot : aiFirstUnknownSlot(player);
    if (swapSlot >= 0) {
      const ownCard = player.cards[swapSlot];
      player.cards[swapSlot] = targetCard;
      G.players[targetInfo.player].cards[targetInfo.slot] = ownCard;
      player.known[swapSlot] = true;
      player.memory[swapSlot] = targetValue;
      if (!G.players[targetInfo.player].isHuman) {
        G.players[targetInfo.player].known[targetInfo.slot] = false;
        G.players[targetInfo.player].memory[targetInfo.slot] = null;
      } else {
        G.players[targetInfo.player].known[targetInfo.slot] = false;
      }
      logAI(player.name, 'stiehlt eine Karte!');
    }
  }
  await delay(600);
}

async function aiHandleGlueckspilz(playerIdx, mustUse) {
  const player = G.players[playerIdx];
  logAI(player.name, 'nutzt Glückspilz! 🍀');
  discardCard(G.drawnCard);
  G.drawnCard = null;

  const cards = [drawCard(), drawCard(), drawCard()];

  let bestIdx = -1, bestValue = 99;
  cards.forEach((c, i) => {
    if (c.type === 'number' && c.value < bestValue) {
      bestValue = c.value;
      bestIdx = i;
    }
  });

  if (bestIdx >= 0 && bestValue <= G.diffCfg.swapDrawnMax) {
    const chosen = cards[bestIdx];
    cards.forEach((c, i) => { if (i !== bestIdx) discardCard(c); });
    G.drawnCard = chosen;
    await aiHandleNumberCard(playerIdx, chosen, false);
  } else if (mustUse && bestIdx >= 0) {
    const chosen = cards[bestIdx];
    cards.forEach((c, i) => { if (i !== bestIdx) discardCard(c); });
    G.drawnCard = chosen;
    await aiHandleNumberCard(playerIdx, chosen, true);
  } else {
    cards.forEach(c => discardCard(c));
  }
  await delay(600);
}

function aiSwapCard(playerIdx, slotIdx) {
  const player = G.players[playerIdx];
  const oldCard = player.cards[slotIdx];
  player.cards[slotIdx] = G.drawnCard;
  player.known[slotIdx] = true;
  player.memory[slotIdx] = G.drawnCard.type === 'number' ? G.drawnCard.value : 99;
  discardCard(oldCard);
  G.drawnCard = null;
}

// AI helper functions
function aiHighestKnownSlot(player) {
  let best = -1, bestVal = -1;
  for (let i = 0; i < 4; i++) {
    if (player.known[i] && player.memory[i] !== null && player.memory[i] > bestVal) {
      bestVal = player.memory[i];
      best = i;
    }
  }
  return best;
}

function aiFirstUnknownSlot(player) {
  for (let i = 0; i < 4; i++) {
    if (!player.known[i]) return i;
  }
  return -1;
}

function aiBestSlotForValue(player, value) {
  const highSlot = aiHighestKnownSlot(player);
  if (highSlot >= 0 && player.memory[highSlot] > value) return highSlot;
  const unknownSlot = aiFirstUnknownSlot(player);
  if (unknownSlot >= 0) return unknownSlot;
  return highSlot >= 0 ? highSlot : 0;
}

function aiRandomOpponentSlot(playerIdx) {
  const opponents = [];
  for (let i = 0; i < G.numPlayers; i++) {
    if (i !== playerIdx) opponents.push(i);
  }
  if (opponents.length === 0) return null;
  const opp = opponents[Math.floor(Math.random() * opponents.length)];
  const slot = Math.floor(Math.random() * 4);
  return { player: opp, slot };
}

function aiShouldKnock(player) {
  const cfg = G.diffCfg;
  let knownSum = 0, knownCount = 0;
  for (let i = 0; i < 4; i++) {
    if (player.known[i] && player.memory[i] !== null) {
      knownSum += player.memory[i];
      knownCount++;
    }
  }
  if (knownCount === 4 && knownSum <= cfg.knockMax) return true;
  if (knownCount >= 3 && knownSum <= Math.max(cfg.knockMax - 4, 3)) return Math.random() < 0.5;
  if (G.difficulty === 'impossible' && knownCount >= 3 && knownSum <= cfg.knockMax - 2) return true;
  return false;
}

function logAI(name, action) {
  G.actionLog.push(`${name} ${action}`);
  if (G.actionLog.length > 20) G.actionLog.shift();
}

// ── Round end ───────────────────────────────────────────────
function endRound() {
  G.phase = 'round_end';

  // Replace special cards with draws from draw pile
  for (const player of G.players) {
    for (let i = 0; i < 4; i++) {
      while (player.cards[i].type !== 'number') {
        discardCard(player.cards[i]);
        player.cards[i] = drawCard();
      }
    }
  }

  // Calculate scores
  const roundScores = [];
  for (const player of G.players) {
    let sum = 0;
    for (const card of player.cards) sum += card.value;
    player.roundScores.push(sum);
    player.totalScore += sum;
    roundScores.push(sum);
  }

  showRoundEndOverlay(roundScores);
}

function showRoundEndOverlay(roundScores) {
  const container = document.getElementById('round-results');
  container.innerHTML = '';

  const minScore = Math.min(...roundScores);

  for (let i = 0; i < G.numPlayers; i++) {
    const p = G.players[i];
    const row = document.createElement('div');
    row.className = 'result-row';
    if (roundScores[i] === minScore) row.classList.add('winner');
    if (i === G.knockedBy) row.classList.add('knocker');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'result-name';
    nameSpan.textContent = p.name;

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'result-cards';
    for (const card of p.cards) {
      const mini = document.createElement('div');
      mini.className = `mini-card card-face card-num-${card.value}`;
      mini.textContent = card.value;
      cardsDiv.appendChild(mini);
    }

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'result-score';
    scoreSpan.textContent = roundScores[i];

    row.appendChild(nameSpan);
    row.appendChild(cardsDiv);
    row.appendChild(scoreSpan);
    container.appendChild(row);
  }

  document.getElementById('round-end-title').textContent =
    G.roundNumber >= G.totalRounds ? 'Letzte Runde beendet!' : `Runde ${G.roundNumber} beendet`;

  const nextBtn = document.getElementById('next-round-btn');
  if (G.roundNumber >= G.totalRounds) {
    nextBtn.textContent = 'Endergebnis';
    nextBtn.onclick = () => {
      document.getElementById('round-overlay').classList.add('hidden');
      showGameOver();
    };
  } else {
    nextBtn.textContent = 'Nächste Runde';
    nextBtn.onclick = () => {
      document.getElementById('round-overlay').classList.add('hidden');
      G.roundNumber++;
      startRound();
    };
  }

  document.getElementById('round-overlay').classList.remove('hidden');
}

function showGameOver() {
  G.phase = 'game_over';
  const container = document.getElementById('final-results');
  container.innerHTML = '';

  const sorted = [...G.players].sort((a, b) => a.totalScore - b.totalScore);
  const winScore = sorted[0].totalScore;

  const table = document.createElement('table');
  table.className = 'final-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Platz', 'Name', ...Array.from({ length: G.totalRounds }, (_, i) => `R${i + 1}`), 'Gesamt'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  sorted.forEach((p, idx) => {
    const tr = document.createElement('tr');
    if (p.totalScore === winScore) tr.className = 'winner-row';

    const tdRank = document.createElement('td');
    tdRank.textContent = `${idx + 1}.`;
    tr.appendChild(tdRank);

    const tdName = document.createElement('td');
    tdName.textContent = p.name;
    tr.appendChild(tdName);

    for (const rs of p.roundScores) {
      const td = document.createElement('td');
      td.textContent = rs;
      tr.appendChild(td);
    }

    const tdTotal = document.createElement('td');
    tdTotal.className = 'total-col';
    tdTotal.textContent = p.totalScore;
    tr.appendChild(tdTotal);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  for (let i = 0; i < G.numHumans; i++) {
    const p = G.players[i];
    const won = p.totalScore === sorted[0].totalScore;
    saveHighScore(p.name, p.totalScore, G.difficulty, G.numPlayers, won);
  }

  document.getElementById('new-game-btn').onclick = () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    renderHighScores();
  };

  document.getElementById('gameover-overlay').classList.remove('hidden');
}

// ── Rendering ───────────────────────────────────────────────
function render() {
  if (!G) return;

  const diffLabels = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer', impossible: 'Unmöglich' };
  document.getElementById('round-info').textContent = `Runde ${G.roundNumber} / ${G.totalRounds}  ·  ${diffLabels[G.difficulty] || ''}`;
  renderScoreboard();

  // Opponents
  renderOpponents();

  // Table center
  renderPiles();

  // Drawn card
  renderDrawnCard();

  // Human cards
  renderHumanCards();

  // Admin panel
  if (adminOpen) renderAdmin();
}

function renderScoreboard() {
  const sb = document.getElementById('score-board');
  sb.innerHTML = '';
  for (let i = 0; i < G.numPlayers; i++) {
    const div = document.createElement('div');
    div.className = 'score-entry' + (i === G.currentPlayer ? ' active-player' : '');
    div.innerHTML = `<span class="score-name">${G.players[i].name}</span><span class="score-value">${G.players[i].totalScore}</span>`;
    sb.appendChild(div);
  }
}

function renderOpponents() {
  const area = document.getElementById('opponents-area');
  area.innerHTML = '';
  const hi = currentHumanViewIdx();

  for (let i = 0; i < G.numPlayers; i++) {
    if (i === hi) continue;
    const p = G.players[i];
    const div = document.createElement('div');
    div.className = 'opponent';

    const bannerClasses = ['player-banner'];
    if (i === G.currentPlayer) bannerClasses.push('current-turn');
    if (i === G.knockedBy) bannerClasses.push('knocked');

    const banner = document.createElement('div');
    banner.className = bannerClasses.join(' ');
    banner.innerHTML = `<span class="player-name">${p.name}</span>`;
    div.appendChild(banner);

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'player-cards';

    for (let s = 0; s < 4; s++) {
      const card = p.cards[s];
      const cardEl = document.createElement('div');

      if (G.phase === 'round_end' || G.phase === 'game_over' || xrayMode) {
        applyCardFace(cardEl, card);
      } else {
        cardEl.className = 'card card-back';
      }

      if (G.phase === 'select_target' || G.phase === 'dt1_select_target' || G.phase === 'dt2_select_target' || G.phase === 'spion_select' || G.phase === 'dieb_select') {
        cardEl.classList.add('clickable', 'highlighted');
        cardEl.addEventListener('click', () => onOpponentCardClick(i, s));
      }

      cardsDiv.appendChild(cardEl);
    }

    div.appendChild(cardsDiv);
    area.appendChild(div);
  }
}

function renderPiles() {
  const drawPileEl = document.getElementById('draw-pile');
  const discardPileEl = document.getElementById('discard-pile');

  // Draw pile
  const countEl = drawPileEl.querySelector('.pile-count');
  countEl.textContent = G.drawPile.length;

  const isHumanDraw = G.players[G.currentPlayer] && G.players[G.currentPlayer].isHuman && G.phase === 'draw';
  drawPileEl.classList.toggle('clickable', isHumanDraw);
  drawPileEl.querySelector('.card').onclick = isHumanDraw ? onDrawPileClick : null;

  // Discard pile
  const discardTop = topDiscard();
  const discardEl = document.getElementById('discard-top');
  if (discardTop) {
    applyCardFace(discardEl, discardTop);
  } else {
    discardEl.className = 'card empty-pile';
    discardEl.innerHTML = '<span>leer</span>';
  }

  const canTakeDiscard = isHumanDraw && discardTop && discardTop.type === 'number';
  discardPileEl.classList.toggle('clickable', canTakeDiscard);
  discardEl.onclick = canTakeDiscard ? onDiscardPileClick : null;
  if (canTakeDiscard) discardEl.classList.add('clickable');
}

function renderDrawnCard() {
  const area = document.getElementById('drawn-card-area');
  const cp = G.players[G.currentPlayer];
  if (G.drawnCard && cp && cp.isHuman) {
    area.classList.remove('hidden');
    const el = document.getElementById('drawn-card');
    applyCardFace(el, G.drawnCard);
  } else {
    area.classList.add('hidden');
  }
}

function currentHumanViewIdx() {
  if (G.players[G.currentPlayer] && G.players[G.currentPlayer].isHuman) return G.currentPlayer;
  return 0;
}

function renderHumanCards() {
  const container = document.getElementById('human-cards');
  container.innerHTML = '';
  const hi = currentHumanViewIdx();
  const human = G.players[hi];

  const bannerEl = document.querySelector('.human-banner');
  const nameEl = bannerEl.querySelector('.player-name');
  nameEl.textContent = human.name;
  bannerEl.classList.toggle('current-turn', G.currentPlayer === hi);
  bannerEl.classList.toggle('knocked', G.knockedBy === hi);

  for (let s = 0; s < 4; s++) {
    const wrapper = document.createElement('div');
    wrapper.style.textAlign = 'center';

    const card = human.cards[s];
    const cardEl = document.createElement('div');

    const faceUp = G.phase === 'round_end' || G.phase === 'game_over' || xrayMode;
    if (faceUp) {
      applyCardFace(cardEl, card);
    } else {
      cardEl.className = 'card card-back';
    }

    const isClickable = shouldHumanCardBeClickable(s);
    if (isClickable) {
      cardEl.classList.add('clickable', 'highlighted');
      cardEl.addEventListener('click', () => onHumanCardClick(s));
    }

    wrapper.appendChild(cardEl);

    const label = document.createElement('div');
    label.className = 'card-slot-label';
    label.textContent = `Karte ${s + 1}`;
    wrapper.appendChild(label);

    container.appendChild(wrapper);
  }
}

function shouldHumanCardBeClickable(slotIdx) {
  const hi = currentHumanViewIdx();
  if (!G.players[hi].isHuman) return false;
  if (G.currentPlayer !== hi) return false;
  if (G.phase === 'initial_peek') {
    const peeked = G.players[hi].humanPeekedSlots || G.humanPeekedSlots;
    return (slotIdx === 0 || slotIdx === 3) && !peeked.includes(slotIdx);
  }
  if (G.phase === 'drawn') return true;
  if (G.phase === 'discard_swap') return true;
  if (G.phase === 'draw_two_1' || G.phase === 'draw_two_2') return true;
  if (G.phase === 'spiegel_1' || G.phase === 'spiegel_2') return true;
  if (G.phase === 'dieb_swap') return true;
  if (G.phase === 'lucky_swap') return true;
  return false;
}

function applyCardFace(el, card) {
  el.className = 'card card-face';

  if (card.type === 'number' && card.value === -999) {
    el.classList.add('card-ueberbiber');
    el.innerHTML = `<span class="card-icon">🌌</span><span class="card-value card-value-uber">−∞</span><span class="card-label">Überbiber</span>`;
  } else if (card.type === 'number' && card.value === 999) {
    el.classList.add('card-fluchbiber');
    el.innerHTML = `<span class="card-icon">💀</span><span class="card-value card-value-uber">+∞</span><span class="card-label">Fluchbiber</span>`;
  } else if (card.type === 'number') {
    el.classList.add(`card-num-${card.value}`);
    el.innerHTML = `<span class="card-value">${card.value}</span>`;
  } else if (card.type === 'peek') {
    el.classList.add('card-peek');
    el.innerHTML = `<span class="card-icon">👁</span><span class="card-label">Spähen</span>`;
  } else if (card.type === 'swap') {
    el.classList.add('card-swap');
    el.innerHTML = `<span class="card-icon">🔄</span><span class="card-label">Tausch</span>`;
  } else if (card.type === 'draw_two') {
    el.classList.add('card-draw-two');
    el.innerHTML = `<span class="card-value">2×</span><span class="card-label">Ziehen</span>`;
  } else if (card.type === 'chaos') {
    el.classList.add('card-chaos');
    el.innerHTML = `<span class="card-icon">🌀</span><span class="card-label">Chaos</span>`;
  } else if (card.type === 'spion') {
    el.classList.add('card-spion');
    el.innerHTML = `<span class="card-icon">🕵️</span><span class="card-label">Spion</span>`;
  } else if (card.type === 'blitz') {
    el.classList.add('card-blitz');
    el.innerHTML = `<span class="card-icon">⚡</span><span class="card-label">Blitz</span>`;
  } else if (card.type === 'tornado') {
    el.classList.add('card-tornado');
    el.innerHTML = `<span class="card-icon">🌪️</span><span class="card-label">Tornado</span>`;
  } else if (card.type === 'freeze') {
    el.classList.add('card-freeze');
    el.innerHTML = `<span class="card-icon">❄️</span><span class="card-label">Freeze</span>`;
  } else if (card.type === 'spiegel') {
    el.classList.add('card-spiegel');
    el.innerHTML = `<span class="card-icon">🪞</span><span class="card-label">Spiegel</span>`;
  } else if (card.type === 'dieb') {
    el.classList.add('card-dieb');
    el.innerHTML = `<span class="card-icon">🦝</span><span class="card-label">Dieb</span>`;
  } else if (card.type === 'glueckspilz') {
    el.classList.add('card-glueckspilz');
    el.innerHTML = `<span class="card-icon">🍀</span><span class="card-label">Glück</span>`;
  }
}

function highlightHumanCards(on) {
  // Handled via render through phase checks
}

function highlightOpponentCards(on) {
  // Handled via render through phase checks
}

function setMessage(text) {
  document.getElementById('game-message').textContent = text;
}

function setActions(actions) {
  const container = document.getElementById('action-buttons');
  container.innerHTML = '';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = `action-btn ${a.class || 'primary'}`;
    btn.textContent = a.label;
    btn.addEventListener('click', a.action);
    container.appendChild(btn);
  }
}

function showAIThinking(on) {
  if (on) {
    const msg = document.getElementById('game-message');
    msg.innerHTML = `<span class="ai-thinking">${msg.textContent} <span class="dots"><span></span><span></span><span></span></span></span>`;
  }
}

function showPeekOverlay(card, label, callback) {
  const display = document.getElementById('peek-card-display');
  display.innerHTML = '';
  const cardEl = document.createElement('div');
  applyCardFace(cardEl, card);
  cardEl.style.setProperty('--card-width', '90px');
  cardEl.style.setProperty('--card-height', '126px');
  display.appendChild(cardEl);

  document.getElementById('peek-message').textContent = label;
  const overlay = document.getElementById('peek-overlay');
  overlay.classList.remove('hidden');

  function closePeek(e) {
    // allow click anywhere on the overlay to close
    overlay.removeEventListener('click', closePeek);
    overlay.classList.add('hidden');
    if (callback) {
      callback();
    } else {
      onPeekClose();
    }
  }

  // small delay so the opening click doesn't immediately close
  setTimeout(() => {
    overlay.addEventListener('click', closePeek);
  }, 100);
}

// ── Utilities ───────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Admin Panel ─────────────────────────────────────────────
let adminOpen = false;
let xrayMode = false;
let autoPlay = false;

const CARD_OPTIONS = [
  { type: 'number', value: -999, label: '−∞ Überbiber' },
  { type: 'number', value: -3, label: '-3' },
  { type: 'number', value: -2, label: '-2' },
  { type: 'number', value: -1, label: '-1' },
  { type: 'number', value: 0,  label: '0' },
  { type: 'number', value: 1,  label: '1' },
  { type: 'number', value: 2,  label: '2' },
  { type: 'number', value: 3,  label: '3' },
  { type: 'number', value: 4,  label: '4' },
  { type: 'number', value: 5,  label: '5' },
  { type: 'number', value: 6,  label: '6' },
  { type: 'number', value: 7,  label: '7' },
  { type: 'number', value: 8,  label: '8' },
  { type: 'number', value: 9,  label: '9' },
  { type: 'number', value: 999, label: '+∞ Fluchbiber' },
  { type: 'peek',   value: null, label: 'Spähen' },
  { type: 'swap',   value: null, label: 'Tausch' },
  { type: 'draw_two', value: null, label: '2×Ziehen' },
  { type: 'chaos',  value: null, label: 'Chaos' },
  { type: 'spion',  value: null, label: 'Spion' },
  { type: 'blitz',  value: null, label: 'Blitz' },
  { type: 'tornado', value: null, label: 'Tornado' },
  { type: 'freeze', value: null, label: 'Freeze' },
  { type: 'spiegel', value: null, label: 'Spiegel' },
  { type: 'dieb',   value: null, label: 'Dieb' },
  { type: 'glueckspilz', value: null, label: 'Glück' },
];

function toggleAdmin() {
  adminOpen = !adminOpen;
  document.getElementById('admin-panel').classList.toggle('hidden', !adminOpen);
  if (adminOpen) renderAdmin();
}

function renderAdmin() {
  if (!G || !adminOpen) return;
  const body = document.getElementById('admin-body');
  body.innerHTML = '';

  body.appendChild(buildAdminState());
  body.appendChild(buildAutoPlayToggle());
  body.appendChild(buildXRayToggle());
  body.appendChild(buildSpeedControl());
  body.appendChild(buildPhaseOverride());
  body.appendChild(buildSetCurrentPlayer());
  body.appendChild(buildRoundControl());
  body.appendChild(buildAIMemory());
  body.appendChild(buildHumanKnowledge());
  body.appendChild(buildPlayerEditor());
  body.appendChild(buildDeckComposition());
  body.appendChild(buildDrawPilePeek());
  body.appendChild(buildDrawPileControl());
  body.appendChild(buildDiscardViewer());
  body.appendChild(buildQuickActions());
  body.appendChild(buildCheatActions());
  body.appendChild(buildSwapHands());
  body.appendChild(buildDifficultyControl());
  body.appendChild(buildGameLog());
  body.appendChild(buildExportImport());
  body.appendChild(buildClearData());
}

function buildAdminState() {
  const sec = adminSection('Spielzustand');
  const grid = document.createElement('div');
  grid.className = 'admin-state-grid';

  const phaseLabels = {
    initial_peek: 'Anfangs-Peek', draw: 'Ziehen', drawn: 'Gezogen',
    discard_swap: 'Abl.-Tausch', select_target: 'Ziel wählen',
    spion_select: 'Spion-Ziel', knock_check: 'Klopf-Check',
    draw_two_1: '2×Ziehen #1', draw_two_2: '2×Ziehen #2',
    dt1_select_target: 'DT1-Ziel', dt2_select_target: 'DT2-Ziel',
    round_end: 'Runde Ende', game_over: 'Spielende',
  };

  const entries = [
    ['Phase', phaseLabels[G.phase] || G.phase],
    ['Am Zug', G.players[G.currentPlayer]?.name || '–'],
    ['Geklopft', G.knockedBy >= 0 ? G.players[G.knockedBy].name : '–'],
    ['Letzte Züge', G.lastRoundTurnsLeft >= 0 ? G.lastRoundTurnsLeft : '–'],
    ['Nachziehstapel', G.drawPile.length],
    ['Ablagestapel', G.discardPile.length],
    ['Runde', `${G.roundNumber} / ${G.totalRounds}`],
    ['Gezogene Karte', G.drawnCard ? cardDisplayName(G.drawnCard) : '–'],
  ];

  for (const [label, value] of entries) {
    const l = document.createElement('span');
    l.className = 'asg-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'asg-value';
    v.textContent = value;
    grid.appendChild(l);
    grid.appendChild(v);
  }
  sec.appendChild(grid);
  return sec;
}

function buildXRayToggle() {
  const sec = adminSection('Sichtbarkeit');
  const row = document.createElement('label');
  row.className = 'admin-toggle-row';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'admin-xray';
  cb.checked = xrayMode;
  cb.addEventListener('change', () => {
    xrayMode = cb.checked;
    render();
  });
  row.appendChild(cb);
  row.appendChild(document.createTextNode('X-Ray Modus (alle Karten aufdecken)'));
  sec.appendChild(row);
  return sec;
}

function buildPlayerEditor() {
  const sec = adminSection('Spieler & Karten');

  for (let pi = 0; pi < G.numPlayers; pi++) {
    const p = G.players[pi];
    const block = document.createElement('div');
    block.className = 'admin-player-block';

    // Name + score
    const header = document.createElement('div');
    header.className = 'admin-player-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'admin-player-name';
    nameEl.textContent = p.name;
    header.appendChild(nameEl);

    const scoreLabel = document.createElement('span');
    scoreLabel.style.fontSize = '0.75rem';
    scoreLabel.style.color = 'rgba(255,255,255,0.4)';
    scoreLabel.textContent = 'Pkt:';
    header.appendChild(scoreLabel);

    const scoreInput = document.createElement('input');
    scoreInput.type = 'number';
    scoreInput.className = 'admin-score-input';
    scoreInput.value = p.totalScore;
    scoreInput.addEventListener('change', () => {
      p.totalScore = parseInt(scoreInput.value) || 0;
      render();
    });
    header.appendChild(scoreInput);

    block.appendChild(header);

    // Cards
    const cardsRow = document.createElement('div');
    cardsRow.className = 'admin-cards-row';

    for (let ci = 0; ci < 4; ci++) {
      const sel = document.createElement('select');
      sel.className = 'admin-card-select';

      for (const opt of CARD_OPTIONS) {
        const o = document.createElement('option');
        o.value = `${opt.type}|${opt.value}`;
        o.textContent = opt.label;
        if (p.cards[ci] && p.cards[ci].type === opt.type && p.cards[ci].value === opt.value) {
          o.selected = true;
        }
        sel.appendChild(o);
      }

      sel.addEventListener('change', () => {
        const [type, val] = sel.value.split('|');
        const newVal = val === 'null' ? null : parseInt(val);
        p.cards[ci] = { id: 9000 + pi * 4 + ci, type, value: newVal };
        if (!p.isHuman && p.memory) {
          p.memory[ci] = type === 'number' ? newVal : 99;
          p.known[ci] = true;
        }
        render();
      });

      cardsRow.appendChild(sel);
    }

    block.appendChild(cardsRow);
    sec.appendChild(block);
  }

  return sec;
}

function buildDrawPileControl() {
  const sec = adminSection('Nächste Karte festlegen');
  const desc = document.createElement('div');
  desc.style.fontSize = '0.72rem';
  desc.style.color = 'rgba(255,255,255,0.4)';
  desc.style.marginBottom = '6px';
  desc.textContent = 'Klicke, um diese Karte oben auf den Nachziehstapel zu legen:';
  sec.appendChild(desc);

  const row = document.createElement('div');
  row.className = 'admin-pile-row';

  for (const opt of CARD_OPTIONS) {
    const btn = document.createElement('button');
    btn.className = 'admin-pile-btn';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      G.drawPile.push({ id: 8000 + Math.random() * 1000 | 0, type: opt.type, value: opt.value });
      renderAdmin();
      render();
    });
    row.appendChild(btn);
  }

  sec.appendChild(row);
  return sec;
}

function buildQuickActions() {
  const sec = adminSection('Schnellaktionen');
  const row = document.createElement('div');
  row.className = 'admin-actions';

  const actions = [
    { label: 'Zug überspringen', cls: '', fn: () => { advanceTurn(); } },
    { label: 'Klopfen (aktiv)', cls: 'admin-warn', fn: () => {
      G.knockedBy = G.currentPlayer;
      G.lastRoundTurnsLeft = G.numPlayers - 1;
      setMessage(`${G.players[G.currentPlayer].name} klopft! (Admin)`);
      render();
    }},
    { label: 'Runde beenden', cls: 'admin-danger', fn: () => { endRound(); } },
    { label: 'Neue Runde', cls: 'admin-success', fn: () => {
      G.roundNumber++;
      if (G.roundNumber > G.totalRounds) G.totalRounds = G.roundNumber;
      startRound();
    }},
    { label: 'Chaos auslösen', cls: '', fn: () => { executeChaosbiber(); setMessage('Admin: Chaos!'); render(); } },
    { label: 'Blitz auslösen', cls: '', fn: () => { executeBlitz(); setMessage('Admin: Blitz!'); render(); } },
    { label: 'Tornado auslösen', cls: 'admin-danger', fn: () => { executeTornado(); setMessage('Admin: Tornado! 🌪️'); render(); } },
    { label: 'Freeze (nächster)', cls: '', fn: () => { G.skipNextPlayer = true; setMessage('Admin: Nächster Spieler eingefroren ❄️'); render(); } },
    { label: 'Alle Karten aufdecken', cls: 'admin-warn', fn: () => {
      for (const p of G.players) {
        p.known = [true, true, true, true];
        if (p.memory) p.memory = p.cards.map(c => c.type === 'number' ? c.value : 99);
      }
      G.humanPeekedSlots = [0, 1, 2, 3];
      render();
    }},
    { label: 'Stapel mischen', cls: '', fn: () => { shuffle(G.drawPile); setMessage('Admin: Stapel gemischt'); render(); } },
  ];

  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = `admin-btn ${a.cls}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => { a.fn(); renderAdmin(); });
    row.appendChild(btn);
  }

  sec.appendChild(row);
  return sec;
}

function buildDifficultyControl() {
  const sec = adminSection('Schwierigkeit ändern');
  const row = document.createElement('div');
  row.className = 'admin-diff-row';

  const diffs = [
    { key: 'easy', label: 'Leicht' },
    { key: 'medium', label: 'Mittel' },
    { key: 'hard', label: 'Schwer' },
    { key: 'impossible', label: 'Unmöglich' },
  ];

  for (const d of diffs) {
    const btn = document.createElement('button');
    btn.className = 'admin-diff-btn' + (G.difficulty === d.key ? ' active' : '');
    btn.textContent = d.label;
    btn.addEventListener('click', () => {
      G.difficulty = d.key;
      G.diffCfg = DIFF_CONFIG[d.key];
      render();
      renderAdmin();
    });
    row.appendChild(btn);
  }

  sec.appendChild(row);
  return sec;
}

function adminSection(title) {
  const sec = document.createElement('div');
  sec.className = 'admin-section';
  const h = document.createElement('h4');
  h.textContent = title;
  sec.appendChild(h);
  return sec;
}

function buildSpeedControl() {
  const sec = adminSection('⚡ KI-Geschwindigkeit');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:10px;';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '100';
  slider.max = '3000';
  slider.step = '100';
  slider.value = G.diffCfg.aiDelay;
  slider.style.cssText = 'flex:1;accent-color:#e74c3c;';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:0.78rem;color:rgba(255,255,255,0.5);min-width:48px;text-align:right;';
  label.textContent = `${G.diffCfg.aiDelay}ms`;

  slider.addEventListener('input', () => {
    G.diffCfg.aiDelay = parseInt(slider.value);
    label.textContent = `${slider.value}ms`;
  });

  row.appendChild(slider);
  row.appendChild(label);
  sec.appendChild(row);
  return sec;
}

function buildSetCurrentPlayer() {
  const sec = adminSection('🎯 Aktueller Spieler');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

  for (let i = 0; i < G.numPlayers; i++) {
    const btn = document.createElement('button');
    btn.className = `admin-btn ${i === G.currentPlayer ? 'admin-success' : ''}`;
    btn.textContent = G.players[i].name;
    btn.addEventListener('click', () => {
      G.currentPlayer = i;
      G.phase = 'draw';
      G.drawnCard = null;
      render();
      if (G.players[i].isHuman) startHumanTurn();
    });
    row.appendChild(btn);
  }

  sec.appendChild(row);
  return sec;
}

function buildAIMemory() {
  const sec = adminSection('🧠 KI-Gedächtnis');
  let hasAI = false;

  for (let i = 0; i < G.numPlayers; i++) {
    const p = G.players[i];
    if (p.isHuman) continue;
    hasAI = true;
    const row = document.createElement('div');
    row.className = 'admin-player-row';
    row.style.marginBottom = '8px';

    const name = document.createElement('span');
    name.className = 'admin-player-name';
    name.style.minWidth = '70px';
    name.style.fontSize = '0.72rem';
    name.textContent = p.name;
    row.appendChild(name);

    for (let s = 0; s < 4; s++) {
      const chip = document.createElement('span');
      chip.className = 'admin-memory-chip';
      if (p.memory && p.known[s] && p.memory[s] !== null) {
        const val = p.memory[s];
        chip.classList.add(val <= 3 ? 'mem-good' : val >= 7 ? 'mem-bad' : 'mem-mid');
        chip.textContent = val === 99 ? 'SP' : val;
      } else {
        chip.classList.add('mem-unknown');
        chip.textContent = '?';
      }
      row.appendChild(chip);
    }

    const actual = document.createElement('span');
    actual.style.cssText = 'font-size:0.6rem;color:rgba(255,255,255,0.25);margin-left:6px;';
    actual.textContent = `[${p.cards.map(c => c.type === 'number' ? c.value : c.type[0].toUpperCase()).join(',')}]`;
    row.appendChild(actual);

    sec.appendChild(row);
  }

  if (!hasAI) {
    const msg = document.createElement('div');
    msg.style.cssText = 'font-size:0.75rem;color:rgba(255,255,255,0.4);padding:4px;';
    msg.textContent = 'Keine KI-Spieler vorhanden.';
    sec.appendChild(msg);
  }

  return sec;
}

function buildDeckComposition() {
  const sec = adminSection('📦 Stapel (' + G.drawPile.length + ' Karten)');
  const counts = {};
  for (const card of G.drawPile) {
    const key = card.type === 'number' ? String(card.value) : card.type;
    counts[key] = (counts[key] || 0) + 1;
  }

  const grid = document.createElement('div');
  grid.className = 'admin-deck-grid';

  const allKeys = ['-999','-3','-2','-1','0','1','2','3','4','5','6','7','8','9','999','peek','swap','draw_two','chaos','spion','blitz','tornado','freeze','spiegel','dieb','glueckspilz'];
  const keyLabels = {'-999':'−∞','999':'+∞','-3':'-3','-2':'-2','-1':'-1','0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
    peek:'Späh', swap:'Tau', draw_two:'2×', chaos:'Cha', spion:'Spi', blitz:'Bli',
    tornado:'Tor', freeze:'Fre', spiegel:'Spi', dieb:'Die', glueckspilz:'Glü'};

  for (const key of allKeys) {
    const count = counts[key] || 0;
    const chip = document.createElement('div');
    chip.className = 'admin-deck-chip';
    chip.innerHTML = `<div class="adc-count">${count}</div><div class="adc-label">${keyLabels[key] || key}</div>`;
    if (count === 0) chip.style.opacity = '0.3';
    grid.appendChild(chip);
  }

  sec.appendChild(grid);
  return sec;
}

function buildGameLog() {
  const sec = adminSection('📜 Spiellog');
  const list = document.createElement('div');
  list.className = 'admin-log-container';

  if (G.actionLog.length === 0) {
    list.innerHTML = '<div class="admin-log-empty">Noch keine Aktionen</div>';
  } else {
    for (let i = G.actionLog.length - 1; i >= 0; i--) {
      const entry = document.createElement('div');
      entry.className = 'admin-log-entry';
      entry.textContent = G.actionLog[i];
      list.appendChild(entry);
    }
  }

  sec.appendChild(list);
  return sec;
}

function buildAutoPlayToggle() {
  const sec = adminSection('🤖 Auto-Play');
  const row = document.createElement('label');
  row.className = 'admin-toggle-row';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = autoPlay;
  cb.addEventListener('change', () => {
    autoPlay = cb.checked;
    if (autoPlay && G.players[G.currentPlayer] && G.players[G.currentPlayer].isHuman && G.phase === 'draw') {
      autoPlayHumanTurn();
    }
  });
  row.appendChild(cb);
  row.appendChild(document.createTextNode('KI spielt automatisch für dich'));
  sec.appendChild(row);
  return sec;
}

function buildPhaseOverride() {
  const sec = adminSection('🔧 Phase setzen');
  const allPhases = [
    'initial_peek','draw','drawn','discard_swap','select_target',
    'spion_select','dieb_select','dieb_swap','spiegel_1','spiegel_2',
    'lucky_pick','lucky_swap','knock_check',
    'draw_two_1','draw_two_2','dt1_select_target','dt2_select_target',
    'round_end','game_over'
  ];
  const sel = document.createElement('select');
  sel.className = 'admin-card-select';
  sel.style.width = '100%';
  for (const phase of allPhases) {
    const o = document.createElement('option');
    o.value = phase;
    o.textContent = phase;
    if (G.phase === phase) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    G.phase = sel.value;
    render();
  });
  sec.appendChild(sel);
  return sec;
}

function buildRoundControl() {
  const sec = adminSection('🔄 Runden-Kontrolle');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;align-items:center;';

  const mkInput = (label, val, onChange) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:0.72rem;color:rgba(255,255,255,0.5);';
    lbl.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'admin-score-input';
    inp.value = val;
    inp.min = '1';
    inp.addEventListener('change', () => onChange(parseInt(inp.value) || 1));
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    return wrap;
  };

  row.appendChild(mkInput('Runde:', G.roundNumber, v => { G.roundNumber = v; render(); }));
  row.appendChild(mkInput('von:', G.totalRounds, v => { G.totalRounds = v; render(); }));

  sec.appendChild(row);
  return sec;
}

function buildHumanKnowledge() {
  const mi = me();
  const sec = adminSection(`👁 ${G.players[mi].name} Kartenwissen`);
  const human = G.players[mi];
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;';

  for (let i = 0; i < 4; i++) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = human.known[i];
    cb.style.accentColor = '#e74c3c';
    const cardVal = human.cards[i].type === 'number' ? human.cards[i].value : human.cards[i].type[0].toUpperCase();
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:0.68rem;color:rgba(255,255,255,0.5);';
    lbl.textContent = `K${i + 1}: ${cardVal}`;
    cb.addEventListener('change', () => {
      human.known[i] = cb.checked;
      if (cb.checked && !G.humanPeekedSlots.includes(i)) G.humanPeekedSlots.push(i);
      render();
    });
    wrap.appendChild(cb);
    wrap.appendChild(lbl);
    row.appendChild(wrap);
  }

  sec.appendChild(row);
  return sec;
}

function buildDiscardViewer() {
  const sec = adminSection('🗑 Ablagestapel (' + G.discardPile.length + ')');
  if (G.discardPile.length === 0) {
    const e = document.createElement('div');
    e.className = 'admin-log-empty';
    e.textContent = 'Leer';
    sec.appendChild(e);
    return sec;
  }
  const list = document.createElement('div');
  list.style.cssText = 'max-height:100px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:3px;';
  for (let i = G.discardPile.length - 1; i >= 0; i--) {
    const c = G.discardPile[i];
    const chip = document.createElement('span');
    chip.style.cssText = 'padding:2px 6px;border-radius:4px;font-size:0.68rem;font-weight:700;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);';
    chip.textContent = cardDisplayName(c);
    list.appendChild(chip);
  }
  sec.appendChild(list);
  return sec;
}

function buildDrawPilePeek() {
  const sec = adminSection('🔮 Nächste 5 Karten');
  if (G.drawPile.length === 0) {
    const e = document.createElement('div');
    e.className = 'admin-log-empty';
    e.textContent = 'Stapel leer';
    sec.appendChild(e);
    return sec;
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px;';
  const count = Math.min(5, G.drawPile.length);
  for (let i = G.drawPile.length - 1; i >= G.drawPile.length - count; i--) {
    const c = G.drawPile[i];
    const chip = document.createElement('span');
    chip.style.cssText = 'padding:4px 8px;border-radius:6px;font-size:0.78rem;font-weight:700;border:1px solid rgba(255,255,255,0.15);';
    const pos = G.drawPile.length - i;
    if (c.type === 'number') {
      chip.style.background = c.value <= 3 ? 'rgba(46,204,113,0.25)' : c.value >= 7 ? 'rgba(231,76,60,0.25)' : 'rgba(241,196,15,0.25)';
      chip.style.color = 'white';
    } else {
      chip.style.background = 'rgba(52,152,219,0.25)';
      chip.style.color = '#3498db';
    }
    chip.textContent = `${pos}. ${cardDisplayName(c)}`;
    row.appendChild(chip);
  }
  sec.appendChild(row);
  return sec;
}

function buildCheatActions() {
  const sec = adminSection('💀 Cheats');
  const row = document.createElement('div');
  row.className = 'admin-actions';

  const cheats = [
    // 1
    { label: '👑 Biber-Gott', cls: 'admin-danger', fn: () => {
      const MI = me(); const human = G.players[MI];
      const best = [-3, -2, -1, 0];
      for (let i = 0; i < 4; i++) {
        human.cards[i] = { id: 9900 + i, type: 'number', value: best[i] };
        human.known[i] = true;
      }
      for (let i = 1; i < G.numPlayers; i++) {
        for (let s = 0; s < 4; s++) G.players[i].cards[s] = { id: 9910 + i*4+s, type: 'number', value: 9 };
        G.players[i].known = [false,false,false,false];
        if (G.players[i].memory) G.players[i].memory = [null,null,null,null];
      }
      G.humanPeekedSlots = [0,1,2,3];
      G.players[me()].totalScore -= 30;
      setMessage('BIBER-GOTT AKTIVIERT! Perfekte Hand + Gegner 9er + Score -30!'); render();
    }},
    // 2
    { label: '🏆 Perfekte Hand', cls: 'admin-success', fn: () => {
      const v = [-3, -2, -1, 0];
      for (let i = 0; i < 4; i++) {
        G.players[me()].cards[i] = { id: 9900+i, type: 'number', value: v[i] };
        G.players[me()].known[i] = true;
      }
      G.humanPeekedSlots = [0,1,2,3];
      setMessage('Perfekte Hand: -3, -2, -1, 0 = -6 Punkte!'); render();
    }},
    // 3
    { label: '😈 Gegner: alles 9er', cls: 'admin-danger', fn: () => {
      for (let i = 1; i < G.numPlayers; i++)
        for (let s = 0; s < 4; s++)
          G.players[i].cards[s] = { id: 9910+i*4+s, type: 'number', value: 9 };
      setMessage('Alle Gegner haben 36 Punkte!'); render();
    }},
    // 4
    { label: '🏅 Sofort gewinnen', cls: 'admin-warn', fn: () => {
      G.players[me()].totalScore = -99;
      for (let i = 1; i < G.numPlayers; i++) G.players[i].totalScore = 999;
      G.roundNumber = G.totalRounds; endRound();
    }},
    // 5
    { label: '🔮 Hellseher', cls: 'admin-success', fn: () => {
      for (let i = 0; i < 4; i++) G.players[me()].known[i] = true;
      G.humanPeekedSlots = [0,1,2,3];
      setMessage('Du siehst alle deine Karten!'); render();
    }},
    // 6
    { label: '🧠 Gegner: Amnesie', cls: 'admin-warn', fn: () => {
      for (let i = 0; i < G.numPlayers; i++) {
        if (i === me()) continue;
        G.players[i].known = [false,false,false,false];
        if(G.players[i].memory)G.players[i].memory = [null,null,null,null];
      }
      setMessage('Alle Gegner haben alles vergessen!'); render();
    }},
    // 7
    { label: '🦝 Bestes stehlen', cls: 'admin-warn', fn: () => {
      const h = G.players[me()];
      let bc = null, bp = -1, bs = -1;
      for (let i = 1; i < G.numPlayers; i++)
        for (let s = 0; s < 4; s++) {
          const c = G.players[i].cards[s];
          if (c.type === 'number' && (!bc || c.value < bc.value)) { bc=c; bp=i; bs=s; }
        }
      if (bc) {
        let ws = 0, wv = -99;
        for (let s = 0; s < 4; s++) { const v = h.cards[s].type==='number'?h.cards[s].value:99; if(v>wv){wv=v;ws=s;} }
        G.players[bp].cards[bs] = h.cards[ws];
        h.cards[ws] = bc; h.known[ws] = true;
        setMessage(`${bc.value} von ${G.players[bp].name} gestohlen!`);
      }
      render();
    }},
    // 8
    { label: '🏴‍☠️ Pirat: Alles Gute klauen', cls: 'admin-danger', fn: () => {
      const h = G.players[me()];
      for (let i = 1; i < G.numPlayers; i++)
        for (let s = 0; s < 4; s++) {
          const c = G.players[i].cards[s];
          if (c.type === 'number' && c.value <= 2) {
            let ws=0, wv=-99;
            for (let j=0;j<4;j++){const v=h.cards[j].type==='number'?h.cards[j].value:99;if(v>wv){wv=v;ws=j;}}
            G.players[i].cards[s] = h.cards[ws]; h.cards[ws] = c; h.known[ws] = true;
          }
        }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Alle niedrigen Karten gestohlen!'); render();
    }},
    // 9
    { label: '🧬 Klonarmee', cls: 'admin-success', fn: () => {
      const h = G.players[me()];
      let best = h.cards[0], bestV = h.cards[0].type==='number'?h.cards[0].value:99;
      for (let i = 1; i < 4; i++) {
        const v = h.cards[i].type==='number'?h.cards[i].value:99;
        if (v < bestV) { bestV=v; best=h.cards[i]; }
      }
      for (let i = 0; i < 4; i++) {
        h.cards[i] = { id: 9950+i, type:'number', value: bestV === 99 ? 0 : bestV };
        h.known[i] = true;
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage(`Alle Karten sind jetzt ${bestV}!`); render();
    }},
    // 10
    { label: '🕳️ Schwarzes Loch', cls: 'admin-danger', fn: () => {
      let removed = 0;
      for (const p of G.players)
        for (let s = 0; s < 4; s++)
          if (p.cards[s].type==='number' && p.cards[s].value === 9) {
            p.cards[s] = { id: 7700+removed, type:'number', value: Math.floor(Math.random()*4) };
            p.known[s] = false; if (p.memory) p.memory[s] = null; removed++;
          }
      G.drawPile = G.drawPile.filter(c => !(c.type==='number' && c.value===9));
      G.discardPile = G.discardPile.filter(c => !(c.type==='number' && c.value===9));
      G.humanPeekedSlots=[];
      setMessage(`Schwarzes Loch: ${removed} Neuner aus Händen + alle aus Stapeln entfernt!`); render();
    }},
    // 11
    { label: '💎 Minus-Regen', cls: 'admin-success', fn: () => {
      G.drawPile = [];
      const vals = [-3,-2,-1,-1,0,0];
      for (let i = 0; i < 24; i++) G.drawPile.push({ id: 8800+i, type:'number', value: vals[i%vals.length] });
      shuffle(G.drawPile);
      setMessage('Stapel voller Minus-Karten!'); render();
    }},
    // 12
    { label: '🎁 Geschenk-Stapel', cls: 'admin-success', fn: () => {
      const gifts = [-3,-2,-1,-1,0,0,0,1,1,1];
      for (let i = gifts.length-1; i >= 0; i--) G.drawPile.push({ id:8500+i, type:'number', value:gifts[i] });
      setMessage('10 Top-Karten auf den Stapel gelegt!'); render();
    }},
    // 13
    { label: '🌪️ Mega-Tornado', cls: 'admin-danger', fn: () => {
      const all = [];
      for (const p of G.players) all.push(...p.cards);
      all.push(...G.drawPile.splice(0, 8));
      shuffle(all);
      for (const p of G.players) {
        for (let i = 0; i < 4; i++) { p.cards[i]=all.pop()||{id:9999,type:'number',value:5}; p.known[i]=false; if(p.memory)p.memory[i]=null; }
      }
      while(all.length>0)G.drawPile.push(all.pop());
      G.humanPeekedSlots=[];
      setMessage('MEGA-Tornado! Alles durchgemischt!'); render();
    }},
    // 14
    { label: '🎪 Chaos-Party', cls: 'admin-danger', fn: () => {
      for (let i = 0; i < 5; i++) executeChaosbiber();
      executeBlitz(); executeTornado();
      setMessage('5x Chaos + Blitz + Tornado!'); render();
    }},
    // 15
    { label: '⏮️ Doppelzug', cls: '', fn: () => {
      G.currentPlayer = 0; G.phase = 'draw'; G.drawnCard = null;
      setMessage('Du bist nochmal dran!'); startHumanTurn();
    }},
    // 16
    { label: '❄️ Alle einfrieren', cls: '', fn: () => {
      G.skipNextPlayer = true;
      for (let i = 1; i < G.numPlayers; i++) {
        G.players[i].known = G.players[i].known.map(() => false);
        if (G.players[i].memory) G.players[i].memory = [null,null,null,null];
      }
      setMessage('Alle Gegner eingefroren + Gedächtnis gelöscht!'); render();
    }},
    // 17
    { label: '🔄 Kartenkarussell', cls: '', fn: () => {
      const saved = G.players[G.numPlayers-1].cards.slice();
      for (let i = G.numPlayers-1; i > 0; i--) {
        G.players[i].cards = G.players[i-1].cards.slice();
        G.players[i].known=[false,false,false,false]; if(G.players[i].memory)G.players[i].memory=[null,null,null,null];
      }
      G.players[me()].cards = saved;
      G.players[me()].known=[false,false,false,false]; G.humanPeekedSlots=[];
      setMessage('Alle Hände eine Position weitergeschoben!'); render();
    }},
    // 18
    { label: '💣 Sabotage', cls: 'admin-danger', fn: () => {
      for (let i = 1; i < G.numPlayers; i++) {
        const highSlot = Math.floor(Math.random()*4);
        G.players[i].cards[highSlot] = { id:8400+i*10+highSlot, type:'number', value:9 };
        const highSlot2 = (highSlot+2)%4;
        G.players[i].cards[highSlot2] = { id:8400+i*10+highSlot2, type:'number', value:8 };
        if(G.players[i].memory){G.players[i].memory[highSlot]=null;G.players[i].memory[highSlot2]=null;}
        G.players[i].known[highSlot]=false; G.players[i].known[highSlot2]=false;
      }
      setMessage('2 Karten jedes Gegners heimlich durch 8er/9er ersetzt!'); render();
    }},
    // 19
    { label: '🎰 Jackpot', cls: '', fn: () => {
      const deck = shuffle(createDeck());
      G.drawPile.push(...deck);
      setMessage(`${deck.length} Karten zum Stapel hinzugefügt!`); render();
    }},
    // 20
    { label: '✨ Sonderkarten-Stapel', cls: '', fn: () => {
      G.drawPile=[];
      const sp=['peek','swap','draw_two','chaos','spion','blitz','tornado','freeze','spiegel','dieb','glueckspilz'];
      for(let i=0;i<33;i++)G.drawPile.push({id:8600+i,type:sp[i%sp.length],value:null});
      shuffle(G.drawPile);
      setMessage('Nur Sonderkarten im Stapel!'); render();
    }},
    // 21
    { label: '🪄 Gegner-Score +50', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++)G.players[i].totalScore+=50;
      setMessage('Alle Gegner +50 Punkte!'); render();
    }},
    // 22
    { label: '💰 Dein Score -30', cls: 'admin-success', fn: () => {
      G.players[me()].totalScore -= 30;
      setMessage('Dein Score -30!'); render();
    }},
    // 23
    { label: '📊 Gleichmacher', cls: '', fn: () => {
      const avg = Math.round(G.players.reduce((s,p)=>s+p.totalScore,0)/G.numPlayers);
      for(const p of G.players)p.totalScore=avg;
      setMessage(`Alle auf ${avg} Punkte!`); render();
    }},
    // 24
    { label: '⚡ Turbo-KI (100ms)', cls: '', fn: () => {
      G.diffCfg.aiDelay=100;
      setMessage('KI in Lichtgeschwindigkeit!'); render();
    }},
    // 25
    { label: '🐌 Slow-Mo (5s)', cls: '', fn: () => {
      G.diffCfg.aiDelay=5000;
      setMessage('KI braucht 5 Sekunden pro Zug!'); render();
    }},
    // 26
    { label: '🎯 Scharfschütze', cls: 'admin-warn', fn: () => {
      const h = G.players[me()];
      for (let s = 0; s < 4; s++) {
        if (h.cards[s].type==='number' && h.cards[s].value >= 5) {
          h.cards[s] = { id:9960+s, type:'number', value: Math.max(h.cards[s].value - 7, -2) };
        }
        h.known[s] = true;
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Alle hohen Karten um 7 reduziert!'); render();
    }},
    // 27
    { label: '🔄 Runde neu', cls: '', fn: () => {
      for(const p of G.players){ if(p.roundScores.length>0)p.totalScore-=p.roundScores.pop(); }
      startRound();
    }},
    // 28
    { label: '➕ Extra-Runde', cls: 'admin-success', fn: () => {
      G.totalRounds++;
      setMessage(`Jetzt ${G.totalRounds} Runden!`); render();
    }},
    // 29
    { label: '🃏 Karten sortieren', cls: '', fn: () => {
      const h = G.players[me()];
      const sorted = [...h.cards].sort((a,b) => {
        const va = a.type==='number'?a.value:99;
        const vb = b.type==='number'?b.value:99;
        return va-vb;
      });
      for(let i=0;i<4;i++) h.cards[i]=sorted[i];
      setMessage('Deine Karten nach Wert sortiert!'); render();
    }},
    // 30
    { label: '🌌 Überbiber geben', cls: 'admin-danger', fn: () => {
      let ws=0, wv=-9999;
      const h=G.players[me()];
      for(let s=0;s<4;s++){const v=h.cards[s].type==='number'?h.cards[s].value:99;if(v>wv){wv=v;ws=s;}}
      h.cards[ws]={id:6666,type:'number',value:-999};
      h.known[ws]=true; G.humanPeekedSlots=[0,1,2,3];
      setMessage('🌌 ÜBERBIBER! Deine schlechteste Karte ist jetzt −∞!'); render();
    }},
    // 31
    { label: '🌌 Überbiber-Hand (4x)', cls: 'admin-danger', fn: () => {
      for(let i=0;i<4;i++){
        G.players[me()].cards[i]={id:6660+i,type:'number',value:-999};
        G.players[me()].known[i]=true;
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('🌌🌌🌌🌌 4x ÜBERBIBER! −3996 Punkte! UNMÖGLICH ZU SCHLAGEN!'); render();
    }},
    // 32
    { label: '🌌 Überbiber auf Stapel', cls: 'admin-warn', fn: () => {
      G.drawPile.push({id:6670,type:'number',value:-999});
      setMessage('🌌 Überbiber oben auf dem Nachziehstapel!'); render();
    }},
    // 33
    { label: '📉 Scores auf 0', cls: '', fn: () => {
      for(const p of G.players){p.totalScore=0;p.roundScores=[];}
      setMessage('Alle Scores zurückgesetzt!'); render();
    }},
    // 31
    { label: '🎲 Zufällige Hände', cls: '', fn: () => {
      const td = shuffle(createDeck().filter(c=>c.type==='number'));
      for(const p of G.players){
        for(let s=0;s<4;s++){p.cards[s]=td.pop()||{id:9999,type:'number',value:5};p.known[s]=false;if(p.memory)p.memory[s]=null;}
      }
      G.humanPeekedSlots=[];
      setMessage('Alle Hände komplett neu gemischt!'); render();
    }},
    // 32
    { label: '⏩ Sofort Spielende', cls: 'admin-danger', fn: () => {
      G.roundNumber=G.totalRounds; endRound();
    }},
    // 33
    { label: '🎯 Nullen für dich', cls: 'admin-success', fn: () => {
      for(let i=0;i<4;i++){G.players[me()].cards[i]={id:9940+i,type:'number',value:0};G.players[me()].known[i]=true;}
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Alle deine Karten sind 0!'); render();
    }},
    // 34
    { label: '🕵️ Alle Karten sehen', cls: 'admin-warn', fn: () => {
      let msg = '';
      for(let i=0;i<G.numPlayers;i++){
        const p=G.players[i];
        const vals = p.cards.map(c=>c.type==='number'?c.value:c.type.substring(0,3)).join(', ');
        msg += `${p.name}: [${vals}]  `;
      }
      setMessage(msg); render();
    }},
    // 35
    { label: '💀 Neuner-Flut', cls: 'admin-danger', fn: () => {
      G.drawPile=[];
      for(let i=0;i<25;i++)G.drawPile.push({id:8700+i,type:'number',value:9});
      setMessage('Stapel voller 9er!'); render();
    }},
    // 36
    { label: '🔥 Inferno', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<4;s++){
          const c=G.players[i].cards[s];
          if(c.type==='number' && c.value<7) G.players[i].cards[s]={id:7600+i*4+s,type:'number',value:c.value+4};
          if(G.players[i].memory)G.players[i].memory[s]=null;
        }
      }
      setMessage('Alle Gegnerkarten +4!'); render();
    }},
    // 37
    { label: '🧊 Eiszeit', cls: '', fn: () => {
      for(let i=0;i<4;i++){
        G.players[me()].cards[i]={id:9970+i,type:'number',value:-2};
        G.players[me()].known[i]=true;
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Alle Karten sind Eisbiber (-2)!'); render();
    }},
    // 38
    { label: '🥇 Goldbiber-Hand', cls: 'admin-success', fn: () => {
      for(let i=0;i<4;i++){
        G.players[me()].cards[i]={id:9980+i,type:'number',value:-3};
        G.players[me()].known[i]=true;
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Alle Karten sind Goldbiber (-3)! = -12 Punkte!'); render();
    }},
    // 39
    { label: '🎭 Identitätstausch', cls: 'admin-warn', fn: () => {
      const target = 1 + Math.floor(Math.random()*(G.numPlayers-1));
      const myCards = G.players[me()].cards.slice();
      G.players[me()].cards = G.players[target].cards.slice();
      G.players[target].cards = myCards;
      G.players[me()].known=[false,false,false,false]; G.humanPeekedSlots=[];
      if(G.players[target].memory)G.players[target].memory=[null,null,null,null];
      setMessage(`Hände mit ${G.players[target].name} getauscht!`); render();
    }},
    // 40
    { label: '🧲 Magnet', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      let count=0;
      for(let di=G.drawPile.length-1;di>=0&&count<4;di--){
        const c=G.drawPile[di];
        if(c.type==='number'&&c.value<=1){
          let ws=0,wv=-99;
          for(let s=0;s<4;s++){const v=h.cards[s].type==='number'?h.cards[s].value:99;if(v>wv){wv=v;ws=s;}}
          if(wv>c.value){h.cards[ws]=c;h.known[ws]=true;G.drawPile.splice(di,1);count++;}
        }
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage(`${count} niedrige Karten aus dem Stapel magnetisiert!`); render();
    }},
    // 41
    { label: '💫 Wunschkarte', cls: 'admin-success', fn: () => {
      let ws=0,wv=-99;
      const h=G.players[me()];
      for(let s=0;s<4;s++){const v=h.cards[s].type==='number'?h.cards[s].value:99;if(v>wv){wv=v;ws=s;}}
      h.cards[ws]={id:7500,type:'number',value:-3};
      h.known[ws]=true; G.humanPeekedSlots=[0,1,2,3];
      setMessage('Schlechteste Karte wird Goldbiber (-3)!'); render();
    }},
    // 42
    { label: '🌊 Flutwelle', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        const worst=Math.floor(Math.random()*4);
        G.players[i].cards[worst]={id:7400+i,type:'number',value:9};
        if(G.players[i].memory)G.players[i].memory[worst]=null;
      }
      G.drawPile.unshift({id:7399,type:'number',value:-3});
      setMessage('Gegner: je 1 zufällige Karte → 9er! Dein nächster Zug: Goldbiber!'); render();
    }},
    // 43
    { label: '🎪 Zirkus', cls: '', fn: () => {
      const types=['peek','swap','draw_two','chaos','spion','blitz','tornado','freeze','spiegel','dieb','glueckspilz'];
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<4;s++){
          G.players[i].cards[s]={id:7300+i*4+s,type:types[(i*4+s)%types.length],value:null};
          if(G.players[i].memory)G.players[i].memory[s]=99;
        }
      }
      setMessage('Gegner haben nur Sonderkarten!'); render();
    }},
    // 44
    { label: '⚖️ Robin Hood', cls: '', fn: () => {
      let bestP=0,worstP=0,bestS=999,worstS=-999;
      for(let i=0;i<G.numPlayers;i++){
        const s=G.players[i].cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0);
        if(s<bestS){bestS=s;bestP=i;} if(s>worstS){worstS=s;worstP=i;}
      }
      if(bestP!==worstP){
        const temp=G.players[bestP].cards.slice();
        G.players[bestP].cards=G.players[worstP].cards.slice();
        G.players[worstP].cards=temp;
        for(const idx of[bestP,worstP]){G.players[idx].known=[false,false,false,false];if(G.players[idx].memory)G.players[idx].memory=[null,null,null,null];}
        if(bestP===0||worstP===0)G.humanPeekedSlots=[];
      }
      setMessage(`Robin Hood: ${G.players[bestP].name} ↔ ${G.players[worstP].name} getauscht!`); render();
    }},
    // 45
    { label: '🛡️ Schutzschild', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<4;s++)h.known[s]=true;
      for(let i=1;i<G.numPlayers;i++){
        if(G.players[i].memory){
          for(let s=0;s<4;s++){
            const real=h.cards[s].type==='number'?h.cards[s].value:0;
            G.players[i].memory[s]=real+5;
          }
        }
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Schutzschild: KIs denken deine Karten sind 5 höher!'); render();
    }},
    // 46
    { label: '🎩 Zauberer', cls: 'admin-warn', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<4;s++){
        if(h.cards[s].type!=='number'){
          h.cards[s]={id:7200+s,type:'number',value:-1};
          h.known[s]=true;
        }
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Alle Sonderkarten → Null-Biber (-1)!'); render();
    }},
    // 47
    { label: '🔮 Orakel', cls: '', fn: () => {
      const top5=G.drawPile.slice(-5).reverse();
      const info=top5.map((c,i)=>`${i+1}: ${c.type==='number'?c.value:cardDisplayName(c)}`).join(' | ');
      setMessage(`Nächste 5 Karten: ${info}`); render();
    }},
    // 48
    { label: '💥 Nuklear', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<4;s++){
          G.players[i].cards[s]={id:7100+i*4+s,type:'number',value:9};
          if(G.players[i].memory)G.players[i].memory[s]=null;
        }
        G.players[i].totalScore+=25;
      }
      const v=[-3,-2,-1,0];
      for(let i=0;i<4;i++){G.players[me()].cards[i]={id:7050+i,type:'number',value:v[i]};G.players[me()].known[i]=true;}
      G.humanPeekedSlots=[0,1,2,3];
      G.players[me()].totalScore-=25;
      setMessage('NUKLEAR! Gegner: 9er+25 Score | Du: perfekt-25 Score!'); render();
    }},
    // 49
    { label: '🎶 Harmonie', cls: '', fn: () => {
      const h=G.players[me()];
      const vals=h.cards.filter(c=>c.type==='number').map(c=>c.value);
      if(vals.length>=2){
        const min=Math.min(...vals);
        for(let s=0;s<4;s++){
          if(h.cards[s].type==='number')h.cards[s]={id:7000+s,type:'number',value:min};
          h.known[s]=true;
        }
        G.humanPeekedSlots=[0,1,2,3];
        setMessage(`Harmonie: Alle Karten sind jetzt ${min}!`);
      } else { setMessage('Nicht genug Zahlenkarten!'); }
      render();
    }},
    // 50
    { label: '🎲 Russisches Roulette', cls: 'admin-danger', fn: () => {
      const lucky = Math.random() < 0.5;
      if(lucky){
        for(let i=0;i<4;i++){G.players[me()].cards[i]={id:6900+i,type:'number',value:-2};G.players[me()].known[i]=true;}
        G.humanPeekedSlots=[0,1,2,3];
        setMessage('GLÜCK! Alle deine Karten → -2!');
      } else {
        for(let i=0;i<4;i++){G.players[me()].cards[i]={id:6900+i,type:'number',value:8};G.players[me()].known[i]=true;}
        G.humanPeekedSlots=[0,1,2,3];
        setMessage('PECH! Alle deine Karten → 8!');
      }
      render();
    }},
    // 51
    { label: '🧪 Mutation', cls: 'admin-warn', fn: () => {
      for(const p of G.players){
        for(let s=0;s<4;s++){
          if(p.cards[s].type==='number'){
            const delta=Math.floor(Math.random()*7)-3;
            p.cards[s]={id:6800+s,type:'number',value:Math.max(-3,Math.min(9,p.cards[s].value+delta))};
            p.known[s]=false; if(p.memory)p.memory[s]=null;
          }
        }
      }
      G.humanPeekedSlots=[];
      setMessage('Mutation! Alle Karten zufällig -3 bis +3 verändert!'); render();
    }},
    // 52
    { label: '🏰 Festung', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<4;s++)h.known[s]=true;
      G.humanPeekedSlots=[0,1,2,3];
      for(let i=1;i<G.numPlayers;i++){
        if(G.players[i].memory)
          for(let s=0;s<4;s++)G.players[i].memory[s]=9;
      }
      setMessage('Festung: Du siehst alles, KIs denken deine Karten sind 9!'); render();
    }},
    // 53
    { label: '🌈 Regenbogen', cls: '', fn: () => {
      const rainbow=[-3,-1,1,3];
      for(let i=0;i<4;i++){
        G.players[me()].cards[i]={id:6700+i,type:'number',value:rainbow[i]};
        G.players[me()].known[i]=true;
      }
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('Regenbogen-Hand: -3, -1, 1, 3 = 0 Punkte!'); render();
    }},
    // 54
    { label: '⏰ Zeitbombe', cls: 'admin-danger', fn: () => {
      for(let i=0;i<3;i++)G.drawPile.push({id:6600+i,type:'number',value:9});
      for(let i=0;i<3;i++)G.drawPile.splice(Math.floor(Math.random()*G.drawPile.length),0,{id:6610+i,type:'number',value:-3});
      setMessage('3 Neuner und 3 Goldbiber zufällig im Stapel versteckt!'); render();
    }},
    // 55
    { label: '👻 Geisterhand', cls: '', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        const s1=Math.floor(Math.random()*4), s2=(s1+2)%4;
        const temp=G.players[i].cards[s1];
        G.players[i].cards[s1]=G.players[i].cards[s2];
        G.players[i].cards[s2]=temp;
        if(G.players[i].memory){G.players[i].memory[s1]=null;G.players[i].memory[s2]=null;}
        G.players[i].known[s1]=false;G.players[i].known[s2]=false;
      }
      setMessage('Geisterhand: 2 Karten jedes Gegners heimlich vertauscht!'); render();
    }},
    // 56
    { label: '🤑 Geldregen', cls: 'admin-success', fn: () => {
      G.players[me()].totalScore -= 50;
      setMessage('Score -50! Ka-ching!'); render();
    }},
    // 57
    { label: '🌑 Finsternis', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        G.players[i].known=[false,false,false,false];
        if(G.players[i].memory)G.players[i].memory=[null,null,null,null];
        const s=Math.floor(Math.random()*4);
        G.players[i].cards[s]={id:6500+i,type:'number',value:9};
      }
      setMessage('Finsternis: KIs vergessen alles + je 1 heimlicher 9er!'); render();
    }},
    // 58
    { label: '🫅 Königstausch', cls: 'admin-warn', fn: () => {
      let worstP=1,worstS=0,worstV=-99;
      for(let i=1;i<G.numPlayers;i++)
        for(let s=0;s<4;s++){
          const c=G.players[i].cards[s];
          const v=c.type==='number'?c.value:0;
          if(v>worstV){worstV=v;worstP=i;worstS=s;}
        }
      let bestS=0,bestV=99;
      for(let s=0;s<4;s++){
        const c=G.players[me()].cards[s];
        const v=c.type==='number'?c.value:99;
        if(v<bestV){bestV=v;bestS=s;}
      }
      const temp=G.players[me()].cards[bestS];
      G.players[me()].cards[bestS]=G.players[worstP].cards[worstS];
      G.players[worstP].cards[worstS]=temp;
      G.players[me()].known[bestS]=true; G.humanPeekedSlots=[0,1,2,3];
      if(G.players[worstP].memory)G.players[worstP].memory[worstS]=null;
      setMessage(`Deine beste Karte (${bestV}) ↔ ${G.players[worstP].name}s schlechteste (${worstV}) — wait, das ist gut für DICH? Nein, Königstausch heißt du gibst deine BESTE und kriegst die SCHLECHTESTE! Mist!`);
      render();
    }},
    // --- BAN ---
    { label: '🚫 Spieler bannen', cls: 'admin-danger', fn: () => {
      if(G.numPlayers <= 2){ setMessage('Mindestens 2 Spieler nötig!'); render(); return; }
      const target = G.numPlayers - 1;
      const name = G.players[target].name;
      G.players.splice(target, 1);
      G.numPlayers--;
      if(G.currentPlayer >= G.numPlayers) G.currentPlayer = 0;
      setMessage(`🚫 ${name} wurde GEBANNT! Nur noch ${G.numPlayers} Spieler!`); render();
    }},
    // --- MEHR KARTEN ---
    { label: '🃏 +1 Karte für alle', cls: 'admin-warn', fn: () => {
      const deck = shuffle(createDeck().filter(c=>c.type==='number'));
      for(const p of G.players){
        const c = deck.pop() || {id:5500,type:'number',value:5};
        p.cards.push(c);
        p.known.push(false);
        if(p.memory) p.memory.push(null);
      }
      setMessage(`Jeder hat jetzt ${G.players[me()].cards.length} Karten!`); render();
    }},
    { label: '🃏🃏 +2 Karten für alle', cls: 'admin-warn', fn: () => {
      const deck = shuffle(createDeck().filter(c=>c.type==='number'));
      for(const p of G.players){
        for(let x=0;x<2;x++){
          const c = deck.pop() || {id:5550+x,type:'number',value:5};
          p.cards.push(c);
          p.known.push(false);
          if(p.memory) p.memory.push(null);
        }
      }
      setMessage(`Jeder hat jetzt ${G.players[me()].cards.length} Karten!`); render();
    }},
    { label: '🃏 +1 Karte nur für dich', cls: 'admin-success', fn: () => {
      const vals = [-3,-2,-1,0];
      const v = vals[Math.floor(Math.random()*vals.length)];
      G.players[me()].cards.push({id:5600,type:'number',value:v});
      G.players[me()].known.push(true);
      G.humanPeekedSlots.push(G.players[me()].cards.length-1);
      setMessage(`+1 Karte (${v}) für dich! Du hast jetzt ${G.players[me()].cards.length} Karten!`); render();
    }},
    // --- 10 NEUE CHEATS ---
    { label: '🔥 Fegefeuer', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++){
          if(G.players[i].cards[s].type==='number' && G.players[i].cards[s].value<=3){
            G.players[i].cards[s]={id:5700+i*10+s,type:'number',value:9};
          }
          if(G.players[i].memory) G.players[i].memory[s]=null;
        }
      }
      setMessage('Fegefeuer: Alle Gegnerkarten ≤3 werden 9er!'); render();
    }},
    { label: '🪞 Spiegel-Fluch', cls: 'admin-warn', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++){
          const c=G.players[i].cards[s];
          if(c.type==='number') G.players[i].cards[s]={id:5800+i*10+s,type:'number',value:9-c.value};
          if(G.players[i].memory) G.players[i].memory[s]=null;
        }
      }
      setMessage('Spiegel-Fluch: Alle Gegnerwerte gespiegelt! (0→9, 1→8, 9→0 ...)'); render();
    }},
    { label: '🎯 Halbieren', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<h.cards.length;s++){
        if(h.cards[s].type==='number' && h.cards[s].value>0)
          h.cards[s]={id:5900+s,type:'number',value:Math.floor(h.cards[s].value/2)};
        h.known[s]=true;
      }
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage('Alle positiven Kartenwerte halbiert!'); render();
    }},
    { label: '🎲 Würfel des Schicksals', cls: '', fn: () => {
      const roll = Math.floor(Math.random()*6)+1;
      const effects = [
        ()=>{ for(let i=0;i<4;i++){G.players[me()].cards[i]={id:6000+i,type:'number',value:0};G.players[me()].known[i]=true;} G.humanPeekedSlots=[0,1,2,3]; return '🎯 Alle Nullen!'; },
        ()=>{ for(let i=1;i<G.numPlayers;i++)G.players[i].totalScore+=20; return '😈 Gegner +20!'; },
        ()=>{ G.players[me()].totalScore-=15; return '💰 Score -15!'; },
        ()=>{ G.drawPile.push({id:6050,type:'number',value:-999}); return '🌌 Überbiber auf Stapel!'; },
        ()=>{ executeTornado(); return '🌪️ Tornado!'; },
        ()=>{ for(let i=1;i<G.numPlayers;i++){G.players[i].known=[false,false,false,false];if(G.players[i].memory)G.players[i].memory=[null,null,null,null];} return '🧠 Amnesie!'; },
      ];
      const msg = effects[roll-1]();
      setMessage(`🎲 Würfel: ${roll} → ${msg}`); render();
    }},
    { label: '💀 Todesurteil', cls: 'admin-danger', fn: () => {
      let maxP=1,maxS=0;
      for(let i=1;i<G.numPlayers;i++){
        const s=G.players[i].cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0);
        const ms=G.players[maxP].cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0);
        if(s<ms) maxP=i;
      }
      for(let s=0;s<G.players[maxP].cards.length;s++)
        G.players[maxP].cards[s]={id:6100+s,type:'number',value:9};
      G.players[maxP].totalScore+=30;
      setMessage(`💀 ${G.players[maxP].name}: Alle Karten → 9 + Score +30!`); render();
    }},
    { label: '🌟 Supernova', cls: 'admin-danger', fn: () => {
      for(const p of G.players){
        for(let s=0;s<p.cards.length;s++){
          const c=p.cards[s];
          if(c.type==='number'){
            p.cards[s]={id:6200+s,type:'number',value: Math.floor(Math.random()*13)-3};
            p.known[s]=false; if(p.memory)p.memory[s]=null;
          }
        }
      }
      G.humanPeekedSlots=[];
      setMessage('SUPERNOVA! Alle Karten zufällig -3 bis 9!'); render();
    }},
    { label: '🏦 Bankraub', cls: 'admin-success', fn: () => {
      let total=0;
      for(let i=1;i<G.numPlayers;i++){total+=10;G.players[i].totalScore+=10;}
      G.players[me()].totalScore-=total;
      setMessage(`Bankraub: ${total} Punkte von Gegnern auf dich übertragen (umgekehrt)!`); render();
    }},
    { label: '🤖 KI-Sabotage', cls: 'admin-warn', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        if(G.players[i].memory){
          for(let s=0;s<G.players[i].cards.length;s++){
            const real=G.players[i].cards[s].type==='number'?G.players[i].cards[s].value:0;
            G.players[i].memory[s]=9-real;
            G.players[i].known[s]=true;
          }
        }
      }
      setMessage('KI-Sabotage: KIs denken ihre guten Karten sind schlecht und umgekehrt!'); render();
    }},
    { label: '🎪 Kopie-Wurm', cls: '', fn: () => {
      const h=G.players[me()];
      let bestV=99, bestC=null;
      for(let s=0;s<h.cards.length;s++){
        const v=h.cards[s].type==='number'?h.cards[s].value:99;
        if(v<bestV){bestV=v;bestC=h.cards[s];}
      }
      if(bestC){
        for(let i=1;i<G.numPlayers;i++){
          const ws=Math.floor(Math.random()*G.players[i].cards.length);
          const stolen=G.players[i].cards[ws];
          G.players[i].cards[ws]={id:6300+i,type:bestC.type,value:bestC.value};
          if(G.players[i].memory)G.players[i].memory[ws]=null;
        }
        setMessage(`Kopie-Wurm: Dein ${bestV} wurde bei jedem Gegner eingeschleust!`);
      }
      render();
    }},
    { label: '⚰️ Endgegner', cls: 'admin-danger', fn: () => {
      const v=[-999,-3,-2,-1];
      for(let i=0;i<4;i++){G.players[me()].cards[i]={id:6400+i,type:'number',value:v[i]};G.players[me()].known[i]=true;}
      G.humanPeekedSlots=[0,1,2,3];
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++)G.players[i].cards[s]={id:6450+i*10+s,type:'number',value:9};
        G.players[i].totalScore+=50; G.players[i].known=[false,false,false,false];
        if(G.players[i].memory)G.players[i].memory=[null,null,null,null];
      }
      G.players[me()].totalScore-=50;
      setMessage('⚰️ ENDGEGNER AKTIVIERT! −∞ Hand + Gegner 9er + Score-Dominanz!'); render();
    }},
    // ==================== BAN ZONE ====================
    { label: '🐸 Frosch-Fluch (Deadlock)', cls: 'admin-danger', fn: () => {
      const t = 1+Math.floor(Math.random()*(G.numPlayers-1));
      const name = G.players[t].name;
      for(let s=0;s<G.players[t].cards.length;s++){
        G.players[t].cards[s]={id:5000+s,type:'number',value:9};
        if(G.players[t].memory)G.players[t].memory[s]=null;
      }
      G.players[t].known=[false,false,false,false];
      G.players[t].totalScore+=100;
      G.players[t].name='🐸 '+name;
      setMessage(`🐸 ${name} wurde in einen FROSCH verwandelt! Alle 9er + 100 Score!`); render();
    }},
    { label: '🚫 Letzten bannen', cls: 'admin-danger', fn: () => {
      if(G.numPlayers<=2){setMessage('Min. 2 Spieler!');render();return;}
      const t=G.numPlayers-1;
      const name=G.players[t].name;
      G.players.splice(t,1); G.numPlayers--;
      if(G.currentPlayer>=G.numPlayers)G.currentPlayer=0;
      setMessage(`🚫 ${name} GEBANNT! Noch ${G.numPlayers} Spieler!`); render();
    }},
    { label: '🚫 Besten Gegner bannen', cls: 'admin-danger', fn: () => {
      if(G.numPlayers<=2){setMessage('Min. 2 Spieler!');render();return;}
      let bestI=1,bestS=999;
      for(let i=1;i<G.numPlayers;i++){
        if(G.players[i].totalScore<bestS){bestS=G.players[i].totalScore;bestI=i;}
      }
      const name=G.players[bestI].name;
      G.players.splice(bestI,1); G.numPlayers--;
      if(G.currentPlayer>=G.numPlayers)G.currentPlayer=0;
      setMessage(`🚫 ${name} (Score: ${bestS}) GEBANNT – zu gut!`); render();
    }},
    { label: '🚫 Alle bis auf 1 bannen', cls: 'admin-danger', fn: () => {
      if(G.numPlayers<=2){setMessage('Nur noch 2 Spieler!');render();return;}
      const names=[];
      while(G.numPlayers>2){
        names.push(G.players[G.numPlayers-1].name);
        G.players.splice(G.numPlayers-1,1); G.numPlayers--;
      }
      G.currentPlayer=Math.min(G.currentPlayer,G.numPlayers-1);
      setMessage(`🚫 ${names.join(', ')} ALLE GEBANNT! 1v1!`); render();
    }},
    { label: '☠️ Perma-Nerf', cls: 'admin-danger', fn: () => {
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      G.players[t].totalScore+=200;
      for(let s=0;s<G.players[t].cards.length;s++){
        G.players[t].cards[s]={id:5100+s,type:'number',value:9};
        if(G.players[t].memory)G.players[t].memory[s]=null;
      }
      setMessage(`☠️ ${G.players[t].name}: Score +200 + alle 9er! Permanent generft!`); render();
    }},
    { label: '🔇 Stumm-Schalten', cls: 'admin-warn', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        G.players[i].known=[false,false,false,false];
        if(G.players[i].memory)G.players[i].memory=[null,null,null,null];
        G.players[i].totalScore+=15;
      }
      G.skipNextPlayer=true;
      setMessage('🔇 Alle Gegner: Amnesie + Score+15 + nächster übersprungen!'); render();
    }},
    { label: '🧊 Kryo-Ban', cls: 'admin-danger', fn: () => {
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      for(let s=0;s<G.players[t].cards.length;s++){
        G.players[t].cards[s]={id:5200+s,type:'number',value:8+Math.round(Math.random())};
        if(G.players[t].memory)G.players[t].memory[s]=null;
      }
      G.players[t].known=[false,false,false,false];
      G.players[t].totalScore+=50;
      G.players[t].name='🧊 '+G.players[t].name.replace(/^🧊 /,'');
      setMessage(`🧊 ${G.players[t].name} eingefroren! 8/9er + Score +50!`); render();
    }},
    { label: '🎭 Identitätsdiebstahl', cls: 'admin-warn', fn: () => {
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      const theirCards=G.players[t].cards.map(c=>({...c}));
      G.players[t].cards=G.players[me()].cards.map(c=>({...c}));
      G.players[me()].cards=theirCards;
      for(let s=0;s<4;s++)G.players[me()].known[s]=true;
      G.players[t].known=[false,false,false,false];
      if(G.players[t].memory)G.players[t].memory=[null,null,null,null];
      G.humanPeekedSlots=[0,1,2,3];
      setMessage(`🎭 Karten mit ${G.players[t].name} getauscht + du siehst alles!`); render();
    }},
    { label: '💀 Todes-Spirale', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        const add = 10 * i;
        G.players[i].totalScore += add;
        const worst = Math.floor(Math.random()*G.players[i].cards.length);
        G.players[i].cards[worst]={id:5300+i,type:'number',value:9};
        if(G.players[i].memory)G.players[i].memory[worst]=null;
      }
      setMessage('💀 Todes-Spirale: Gegner 1 +10, Gegner 2 +20, Gegner 3 +30... + je 1 Neuner!'); render();
    }},
    { label: '🏴 Schwarze Liste', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        G.players[i].name='⛔ '+G.players[i].name.replace(/^⛔ /,'');
        G.players[i].totalScore += 25;
        for(let s=0;s<G.players[i].cards.length;s++){
          const c=G.players[i].cards[s];
          if(c.type==='number' && c.value<5)
            G.players[i].cards[s]={id:5400+i*10+s,type:'number',value:c.value+5};
          if(G.players[i].memory)G.players[i].memory[s]=null;
        }
      }
      setMessage('🏴 Schwarze Liste: Alle Gegner markiert + Score+25 + Karten ≤4 werden +5!'); render();
    }},
    { label: '👹 Fluch der 9', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        const slots=G.players[i].cards.length;
        const cursed=Math.min(3,slots);
        const indices=[...Array(slots).keys()];
        for(let x=indices.length-1;x>0;x--){const j=Math.floor(Math.random()*(x+1));[indices[x],indices[j]]=[indices[j],indices[x]];}
        for(let x=0;x<cursed;x++){
          G.players[i].cards[indices[x]]={id:5500+i*10+x,type:'number',value:9};
          if(G.players[i].memory)G.players[i].memory[indices[x]]=null;
        }
      }
      setMessage('👹 Fluch der 9: 3 zufällige Karten jedes Gegners → 9er!'); render();
    }},
    { label: '🪦 Grab-Räuber', cls: 'admin-warn', fn: () => {
      const stolen=[];
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++){
          const c=G.players[i].cards[s];
          if(c.type==='number' && c.value<=0){
            stolen.push({...c});
            G.players[i].cards[s]={id:5600+i*10+s,type:'number',value:9};
            if(G.players[i].memory)G.players[i].memory[s]=null;
          }
        }
      }
      for(const c of stolen) G.drawPile.push(c);
      setMessage(`🪦 ${stolen.length} Minus/Null-Karten von Gegnern geraubt (→9er) und auf den Stapel gelegt!`); render();
    }},
    // ==================== MEGA CHEAT PACK ====================
    { label: '🔁 Umkehr-Runde', cls: '', fn: () => {
      for(const p of G.players){
        for(let s=0;s<p.cards.length;s++){
          if(p.cards[s].type==='number') p.cards[s]={id:4000+s,type:'number',value:9-p.cards[s].value};
          p.known[s]=false; if(p.memory)p.memory[s]=null;
        }
      }
      G.humanPeekedSlots=[];
      setMessage('🔁 ALLE Kartenwerte umgekehrt! 0→9, 9→0, -3→12!'); render();
    }},
    { label: '🎰 Slot Machine', cls: 'admin-warn', fn: () => {
      const results=['🍒','🍋','💎','🌟','💀'];
      const r=results[Math.floor(Math.random()*results.length)];
      if(r==='🍒'){G.players[me()].totalScore-=10;setMessage('🎰 🍒🍒🍒 Score -10!');}
      else if(r==='🍋'){for(let i=0;i<4;i++){G.players[me()].cards[i]={id:4100+i,type:'number',value:1};G.players[me()].known[i]=true;}G.humanPeekedSlots=[0,1,2,3];setMessage('🎰 🍋🍋🍋 Alle Einser!');}
      else if(r==='💎'){G.players[me()].cards[0]={id:4110,type:'number',value:-999};G.players[me()].known[0]=true;G.humanPeekedSlots=[0,1,2,3];setMessage('🎰 💎💎💎 ÜBERBIBER!');}
      else if(r==='🌟'){G.players[me()].totalScore-=50;setMessage('🎰 🌟🌟🌟 JACKPOT! Score -50!');}
      else{G.players[me()].totalScore+=30;setMessage('🎰 💀💀💀 VERLOREN! Score +30!');}
      render();
    }},
    { label: '🎵 Musikalische Stühle', cls: '', fn: () => {
      const hands=G.players.map(p=>p.cards.map(c=>({...c})));
      for(let i=0;i<G.numPlayers;i++){
        const next=(i+1)%G.numPlayers;
        G.players[next].cards=hands[i];
        G.players[next].known=[false,false,false,false];
        if(G.players[next].memory)G.players[next].memory=[null,null,null,null];
      }
      G.humanPeekedSlots=[];
      setMessage('🎵 Musikalische Stühle! Alle Hände 1 weiter!'); render();
    }},
    { label: '🧹 Großreinemachen', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<h.cards.length;s++){
        if(h.cards[s].type==='number' && h.cards[s].value>=7){
          h.cards[s]={id:4200+s,type:'number',value:0};
        }
        h.known[s]=true;
      }
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage('🧹 Alle Karten ≥7 durch Nullen ersetzt!'); render();
    }},
    { label: '🎁 Weihnachten', cls: 'admin-success', fn: () => {
      const gifts=[-3,-2,-1,0,-3,-2];
      for(let i=0;i<Math.min(gifts.length,G.drawPile.length);i++){
        G.drawPile[G.drawPile.length-1-i]={id:4300+i,type:'number',value:gifts[i]};
      }
      G.players[me()].totalScore-=10;
      setMessage('🎁 Frohe Weihnachten! Top 6 Karten = Geschenke + Score -10!'); render();
    }},
    { label: '🦠 Virus', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        const s=Math.floor(Math.random()*G.players[i].cards.length);
        const val=G.players[i].cards[s].type==='number'?G.players[i].cards[s].value:5;
        for(let j=0;j<G.players[i].cards.length;j++){
          G.players[i].cards[j]={id:4400+i*10+j,type:'number',value:Math.min(9,val+j)};
          if(G.players[i].memory)G.players[i].memory[j]=null;
        }
      }
      setMessage('🦠 Virus! Eine Gegnerkarte infiziert alle anderen (+1 pro Karte)!'); render();
    }},
    { label: '🏋️ Gewichtheben', cls: '', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++){
          if(G.players[i].cards[s].type==='number') G.players[i].cards[s].value=Math.min(9,G.players[i].cards[s].value+2);
          if(G.players[i].memory)G.players[i].memory[s]=null;
        }
      }
      setMessage('🏋️ Alle Gegnerkarten +2!'); render();
    }},
    { label: '🍀 Glücksklee', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<h.cards.length;s++){
        if(h.cards[s].type==='number') h.cards[s].value=Math.max(-3,h.cards[s].value-3);
        h.known[s]=true;
      }
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage('🍀 Alle deine Karten -3!'); render();
    }},
    { label: '📦 Paket-Bombe', cls: 'admin-danger', fn: () => {
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      G.players[t].cards.push({id:4500,type:'number',value:9});
      G.players[t].cards.push({id:4501,type:'number',value:9});
      if(G.players[t].memory){G.players[t].memory.push(null);G.players[t].memory.push(null);}
      G.players[t].known.push(false); G.players[t].known.push(false);
      setMessage(`📦 ${G.players[t].name} hat 2 Extra-9er bekommen! ${G.players[t].cards.length} Karten!`); render();
    }},
    { label: '🔀 Shuffle-Wahnsinn', cls: '', fn: () => {
      const all=[];
      for(const p of G.players) for(const c of p.cards) all.push({...c});
      shuffle(all);
      let idx=0;
      for(const p of G.players){
        for(let s=0;s<p.cards.length;s++){
          p.cards[s]=all[idx++]||{id:9999,type:'number',value:5};
          p.known[s]=false; if(p.memory)p.memory[s]=null;
        }
      }
      G.humanPeekedSlots=[];
      setMessage('🔀 ALLE Karten aller Spieler komplett durchgemischt!'); render();
    }},
    { label: '⬆️ Level Up', cls: 'admin-success', fn: () => {
      G.players[me()].totalScore-=25;
      for(let i=0;i<4;i++)G.players[me()].known[i]=true;
      G.humanPeekedSlots=[0,1,2,3];
      G.diffCfg.aiDelay=200;
      setMessage('⬆️ Level Up! Score -25 + Hellseher + Turbo-KI!'); render();
    }},
    { label: '⬇️ Gegner Downgrade', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        G.players[i].totalScore+=25;
        G.players[i].known=[false,false,false,false];
        if(G.players[i].memory)G.players[i].memory=[null,null,null,null];
      }
      setMessage('⬇️ Alle Gegner: Score +25 + totale Amnesie!'); render();
    }},
    { label: '🎲 Würfel-Duell', cls: '', fn: () => {
      const myRoll=Math.floor(Math.random()*6)+1;
      const theirRoll=Math.floor(Math.random()*6)+1;
      if(myRoll>=theirRoll){
        G.players[me()].totalScore-=myRoll*5;
        setMessage(`🎲 Du: ${myRoll} vs Gegner: ${theirRoll} – DU GEWINNST! Score -${myRoll*5}!`);
      } else {
        G.players[me()].totalScore+=theirRoll*3;
        setMessage(`🎲 Du: ${myRoll} vs Gegner: ${theirRoll} – VERLOREN! Score +${theirRoll*3}!`);
      }
      render();
    }},
    { label: '🪙 Münzwurf', cls: '', fn: () => {
      if(Math.random()<0.5){
        const v=[-3,-2,-1,0];
        for(let i=0;i<4;i++){G.players[me()].cards[i]={id:4600+i,type:'number',value:v[i]};G.players[me()].known[i]=true;}
        G.humanPeekedSlots=[0,1,2,3];
        setMessage('🪙 KOPF! Perfekte Hand!');
      } else {
        for(let i=0;i<4;i++){G.players[me()].cards[i]={id:4600+i,type:'number',value:9};G.players[me()].known[i]=true;}
        G.humanPeekedSlots=[0,1,2,3];
        setMessage('🪙 ZAHL! Alles 9er! Pech gehabt!');
      }
      render();
    }},
    { label: '🔥 Verbrennen', cls: 'admin-danger', fn: () => {
      const burned=G.drawPile.splice(-10);
      setMessage(`🔥 ${burned.length} Karten vom Stapel verbrannt! Noch ${G.drawPile.length} übrig!`); render();
    }},
    { label: '🌍 Weltherrschaft', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        G.players[i].totalScore=Math.max(G.players[i].totalScore,G.players[me()].totalScore+50);
        G.players[i].name='🏳️ '+G.players[i].name.replace(/^🏳️ /,'');
      }
      setMessage('🌍 Weltherrschaft! Alle Gegner mindestens 50 Punkte hinter dir!'); render();
    }},
    { label: '💉 Impfung', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<h.cards.length;s++){
        if(h.cards[s].type!=='number') h.cards[s]={id:4700+s,type:'number',value:-2};
        h.known[s]=true;
      }
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage('💉 Alle Sonderkarten → Eisbiber (-2)!'); render();
    }},
    { label: '🎯 Sniper', cls: 'admin-warn', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        let bestS=0,bestV=99;
        for(let s=0;s<G.players[i].cards.length;s++){
          const v=G.players[i].cards[s].type==='number'?G.players[i].cards[s].value:99;
          if(v<bestV){bestV=v;bestS=s;}
        }
        G.players[i].cards[bestS]={id:4800+i,type:'number',value:9};
        if(G.players[i].memory)G.players[i].memory[bestS]=null;
      }
      setMessage('🎯 Sniper! Beste Karte jedes Gegners → 9!'); render();
    }},
    { label: '🧪 Alchemie', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<h.cards.length;s++){
        if(h.cards[s].type==='number' && h.cards[s].value>0)
          h.cards[s]={id:4900+s,type:'number',value:-h.cards[s].value};
        h.known[s]=true;
      }
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage('🧪 Alchemie! Alle positiven Werte → negativ!'); render();
    }},
    { label: '🏴‍☠️ Kaperfahrt', cls: 'admin-warn', fn: () => {
      let count=0;
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++){
          if(G.players[i].cards[s].type==='number' && G.players[i].cards[s].value<=1){
            G.drawPile.push({...G.players[i].cards[s]});
            G.players[i].cards[s]={id:4950+count,type:'number',value:7+Math.floor(Math.random()*3)};
            if(G.players[i].memory)G.players[i].memory[s]=null;
            count++;
          }
        }
      }
      setMessage(`🏴‍☠️ ${count} niedrige Karten gekapert! Gegner haben 7-9er, gute Karten auf Stapel!`); render();
    }},
    { label: '🔔 Glocke', cls: '', fn: () => {
      G.knockedBy=0; G.lastRoundTurnsLeft=G.numPlayers;
      setMessage('🔔 Du hast geklopft! Letzte Runde!'); render();
    }},
    { label: '🔕 Klopfen zurücknehmen', cls: '', fn: () => {
      G.knockedBy=-1; G.lastRoundTurnsLeft=-1;
      setMessage('🔕 Klopfen zurückgenommen!'); render();
    }},
    { label: '🧬 DNA-Tausch', cls: 'admin-warn', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++){
          const c=G.players[i].cards[s];
          if(c.type==='number' && c.value<=2){
            let ws=0,wv=-999;
            const h=G.players[me()];
            for(let j=0;j<h.cards.length;j++){const v=h.cards[j].type==='number'?h.cards[j].value:99;if(v>wv){wv=v;ws=j;}}
            if(wv>c.value){G.players[i].cards[s]=h.cards[ws];h.cards[ws]=c;h.known[ws]=true;}
          }
        }
      }
      G.humanPeekedSlots=G.players[me()].cards.map((_,i)=>i);
      setMessage('🧬 DNA-Tausch: Alle niedrigen Gegnerkarten gegen deine hohen getauscht!'); render();
    }},
    { label: '🌙 Nachtmodus', cls: '', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        G.players[i].known=[false,false,false,false];
        if(G.players[i].memory)G.players[i].memory=[null,null,null,null];
      }
      for(let i=0;i<4;i++)G.players[me()].known[i]=true;
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('🌙 Nachtmodus: Du siehst alles, Gegner sind blind!'); render();
    }},
    { label: '☀️ Sonnenmodus', cls: 'admin-success', fn: () => {
      let msg='Alle Hände: ';
      for(const p of G.players){
        const vals=p.cards.map(c=>c.type==='number'?c.value:c.type.substring(0,3));
        msg+=`${p.name}:[${vals}] `;
      }
      setMessage(msg); render();
    }},
    { label: '🃏 Joker einfügen', cls: 'admin-success', fn: () => {
      G.drawPile.push({id:3000,type:'number',value:-999});
      G.drawPile.push({id:3001,type:'number',value:-3});
      G.drawPile.push({id:3002,type:'number',value:-2});
      setMessage('🃏 Überbiber + Goldbiber + Eisbiber auf den Stapel!'); render();
    }},
    { label: '💰 Kopfgeld', cls: 'admin-danger', fn: () => {
      let bestI=1,bestS=999;
      for(let i=1;i<G.numPlayers;i++)if(G.players[i].totalScore<bestS){bestS=G.players[i].totalScore;bestI=i;}
      G.players[bestI].totalScore+=75;
      for(let s=0;s<G.players[bestI].cards.length;s++){
        G.players[bestI].cards[s]={id:3100+s,type:'number',value:8};
        if(G.players[bestI].memory)G.players[bestI].memory[s]=null;
      }
      setMessage(`💰 Kopfgeld auf ${G.players[bestI].name}! Score +75 + alle 8er!`); render();
    }},
    { label: '🎪 Karten-Lotterie', cls: '', fn: () => {
      const prize=Math.floor(Math.random()*13)-3;
      for(let i=0;i<4;i++){G.players[me()].cards[i]={id:3200+i,type:'number',value:prize};G.players[me()].known[i]=true;}
      G.humanPeekedSlots=[0,1,2,3];
      setMessage(`🎪 Lotterie! Alle deine Karten sind ${prize}!`); render();
    }},
    { label: '💫 Sternenstaub', cls: 'admin-success', fn: () => {
      for(let i=0;i<8;i++) G.drawPile.push({id:3300+i,type:'number',value:Math.floor(Math.random()*3)-3});
      shuffle(G.drawPile);
      setMessage('💫 8 Minus-Karten (-3 bis -1) in den Stapel gestreut!'); render();
    }},
    { label: '🧨 Dynamit', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        const s=Math.floor(Math.random()*G.players[i].cards.length);
        G.players[i].cards.splice(s,0,{id:3400+i,type:'number',value:9});
        G.players[i].known.splice(s,0,false);
        if(G.players[i].memory)G.players[i].memory.splice(s,0,null);
      }
      setMessage(`🧨 Dynamit! Jeder Gegner hat 1 Extra-9er (${G.players[1].cards.length} Karten)!`); render();
    }},
    { label: '🏰 Burgmauer', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      const low=h.cards.filter(c=>c.type==='number'&&c.value<=2).length;
      h.totalScore-=low*5;
      setMessage(`🏰 Burgmauer! ${low} niedrige Karten × -5 = Score -${low*5}!`); render();
    }},
    { label: '⚔️ Duell', cls: 'admin-warn', fn: () => {
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      const mySum=G.players[me()].cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0);
      const theirSum=G.players[t].cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0);
      if(mySum<=theirSum){
        G.players[t].totalScore+=20;
        setMessage(`⚔️ Duell vs ${G.players[t].name}: DU GEWINNST (${mySum} vs ${theirSum})! Gegner +20!`);
      } else {
        G.players[me()].totalScore+=10;
        setMessage(`⚔️ Duell vs ${G.players[t].name}: VERLOREN (${mySum} vs ${theirSum})! Du +10!`);
      }
      render();
    }},
    { label: '🪄 Verzaubern', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      let ws=0,wv=-999;
      for(let s=0;s<h.cards.length;s++){const v=h.cards[s].type==='number'?h.cards[s].value:99;if(v>wv){wv=v;ws=s;}}
      h.cards[ws]={id:3500,type:'number',value:Math.max(-3,wv-8)};
      h.known[ws]=true; G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage(`🪄 Schlechteste Karte (${wv}) verzaubert zu ${h.cards[ws].value}!`); render();
    }},
    { label: '🌋 Vulkan', cls: 'admin-danger', fn: () => {
      for(const p of G.players){
        const s=Math.floor(Math.random()*p.cards.length);
        p.cards[s]={id:3600+Math.random()*100|0,type:'number',value:Math.floor(Math.random()*10)};
        p.known[s]=false; if(p.memory)p.memory[s]=null;
      }
      G.humanPeekedSlots=[];
      setMessage('🌋 Vulkan! 1 zufällige Karte jedes Spielers durch Zufallswert ersetzt!'); render();
    }},
    { label: '🎭 Maskenball', cls: '', fn: () => {
      const indices=[...Array(G.numPlayers).keys()];
      for(let i=indices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
      const hands=G.players.map(p=>p.cards.map(c=>({...c})));
      for(let i=0;i<G.numPlayers;i++){
        G.players[i].cards=hands[indices[i]];
        G.players[i].known=[false,false,false,false];
        if(G.players[i].memory)G.players[i].memory=[null,null,null,null];
      }
      G.humanPeekedSlots=[];
      setMessage('🎭 Maskenball! Alle Hände zufällig vertauscht!'); render();
    }},
    { label: '🤝 Friedensvertrag', cls: '', fn: () => {
      const avg=Math.round(G.players.reduce((s,p)=>s+p.totalScore,0)/G.numPlayers);
      for(const p of G.players){p.totalScore=avg;}
      const avgHand=Math.round(G.players.reduce((s,p)=>s+p.cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0),0)/G.numPlayers/4);
      for(const p of G.players){
        for(let s=0;s<p.cards.length;s++){p.cards[s]={id:3700+s,type:'number',value:avgHand};p.known[s]=false;if(p.memory)p.memory[s]=null;}
      }
      G.humanPeekedSlots=[];
      setMessage(`🤝 Friedensvertrag! Alle Scores = ${avg}, alle Karten = ${avgHand}!`); render();
    }},
    { label: '🎂 Geburtstag', cls: 'admin-success', fn: () => {
      G.players[me()].totalScore-=20;
      G.drawPile.push({id:3800,type:'number',value:-3},{id:3801,type:'number',value:-2},{id:3802,type:'number',value:-1});
      for(let i=0;i<4;i++)G.players[me()].known[i]=true;
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('🎂 Happy Birthday! Score -20 + 3 Minus-Karten auf Stapel + Hellseher!'); render();
    }},
    { label: '📡 Radar', cls: 'admin-success', fn: () => {
      let info='';
      for(let i=1;i<G.numPlayers;i++){
        const sum=G.players[i].cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0);
        const best=Math.min(...G.players[i].cards.map(c=>c.type==='number'?c.value:99));
        info+=`${G.players[i].name}: Σ${sum} (↓${best}) | `;
      }
      setMessage(`📡 ${info}`); render();
    }},
    { label: '🧲 Super-Magnet', cls: 'admin-success', fn: () => {
      const good=G.drawPile.filter(c=>c.type==='number'&&c.value<=0).slice(0,4);
      G.drawPile=G.drawPile.filter(c=>!good.includes(c));
      for(const c of good)G.drawPile.push(c);
      setMessage(`🧲 ${good.length} niedrige Karten nach oben auf den Stapel gezogen!`); render();
    }},
    { label: '💀 Pest', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        for(let s=0;s<G.players[i].cards.length;s++){
          if(G.players[i].cards[s].type==='number')
            G.players[i].cards[s].value=Math.min(9,G.players[i].cards[s].value+3);
          if(G.players[i].memory)G.players[i].memory[s]=null;
        }
      }
      setMessage('💀 Pest! Alle Gegnerkarten +3!'); render();
    }},
    { label: '🏥 Heilung', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      for(let s=0;s<h.cards.length;s++){
        if(h.cards[s].type==='number'&&h.cards[s].value>3) h.cards[s].value=Math.max(0,h.cards[s].value-4);
        h.known[s]=true;
      }
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage('🏥 Alle Karten >3 um 4 geheilt!'); render();
    }},
    { label: '🎮 Konami Code', cls: 'admin-danger', fn: () => {
      const v=[-999,-3,-2,-1];
      for(let i=0;i<4;i++){G.players[me()].cards[i]={id:3900+i,type:'number',value:v[i]};G.players[me()].known[i]=true;}
      G.humanPeekedSlots=[0,1,2,3];
      G.players[me()].totalScore-=100;
      for(let i=1;i<G.numPlayers;i++){G.players[i].totalScore+=100;if(G.players[i].memory)G.players[i].memory=[null,null,null,null];}
      setMessage('🎮 ↑↑↓↓←→←→BA! KONAMI CODE! Alles aktiviert!'); render();
    }},
    // ==================== FLUCHBIBER ZONE ====================
    { label: '☠️ Fluchbiber geben (Gegner)', cls: 'admin-danger', fn: () => {
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      let bs=0,bv=-999;
      for(let s=0;s<G.players[t].cards.length;s++){
        const v=G.players[t].cards[s].type==='number'?G.players[t].cards[s].value:0;
        if(v<bv||s===0){bv=v;bs=s;}
      }
      G.players[t].cards[bs]={id:2000,type:'number',value:999};
      if(G.players[t].memory)G.players[t].memory[bs]=null;
      setMessage(`☠️ ${G.players[t].name} hat den FLUCHBIBER (+∞)! Beste Karte ersetzt!`); render();
    }},
    { label: '☠️ Alle Gegner verfluchen', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        const s=Math.floor(Math.random()*G.players[i].cards.length);
        G.players[i].cards[s]={id:2010+i,type:'number',value:999};
        if(G.players[i].memory)G.players[i].memory[s]=null;
      }
      setMessage('☠️ ALLE Gegner haben einen Fluchbiber (+∞)!'); render();
    }},
    { label: '☠️ Fluchbiber auf Stapel', cls: 'admin-warn', fn: () => {
      G.drawPile.push({id:2020,type:'number',value:999});
      setMessage('☠️ Fluchbiber oben auf dem Stapel – Vorsicht!'); render();
    }},
    { label: '☠️ 4x Fluchbiber (Gegner)', cls: 'admin-danger', fn: () => {
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      for(let s=0;s<G.players[t].cards.length;s++){
        G.players[t].cards[s]={id:2030+s,type:'number',value:999};
        if(G.players[t].memory)G.players[t].memory[s]=null;
      }
      setMessage(`☠️☠️☠️☠️ ${G.players[t].name}: ALLE KARTEN = FLUCHBIBER! +3996 Punkte!`); render();
    }},
    { label: '⚔️ Über vs Fluch', cls: 'admin-warn', fn: () => {
      const h=G.players[me()];
      let ws=0,wv=-9999;
      for(let s=0;s<h.cards.length;s++){const v=h.cards[s].type==='number'?h.cards[s].value:99;if(v>wv){wv=v;ws=s;}}
      h.cards[ws]={id:2040,type:'number',value:-999};h.known[ws]=true;
      const t=1+Math.floor(Math.random()*(G.numPlayers-1));
      let bs2=0,bv2=9999;
      for(let s=0;s<G.players[t].cards.length;s++){const v=G.players[t].cards[s].type==='number'?G.players[t].cards[s].value:0;if(v<bv2){bv2=v;bs2=s;}}
      G.players[t].cards[bs2]={id:2041,type:'number',value:999};
      if(G.players[t].memory)G.players[t].memory[bs2]=null;
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage(`⚔️ Du: Überbiber (−∞) | ${G.players[t].name}: Fluchbiber (+∞)!`); render();
    }},
    { label: '🎰 Fluch-Roulette', cls: 'admin-danger', fn: () => {
      const target=Math.floor(Math.random()*G.numPlayers);
      const s=Math.floor(Math.random()*G.players[target].cards.length);
      G.players[target].cards[s]={id:2050,type:'number',value:999};
      if(target===0){G.players[me()].known[s]=true;G.humanPeekedSlots=G.players[me()].cards.map((_,i)=>i);}
      else{if(G.players[target].memory)G.players[target].memory[s]=null;}
      setMessage(`🎰 Fluch-Roulette: ${G.players[target].name} hat den Fluchbiber! ${target===0?'DU BIST ES!':'Glück gehabt!'}`); render();
    }},
    // ==================== NEUE COOLE SACHEN ====================
    { label: '🔮 Zeitmaschine', cls: 'admin-success', fn: () => {
      for(const p of G.players){
        if(p.roundScores.length>0){
          p.totalScore-=p.roundScores[p.roundScores.length-1];
          p.roundScores.pop();
        }
      }
      if(G.roundNumber>1)G.roundNumber--;
      startRound();
      setMessage('🔮 Zeitmaschine: Letzte Runde rückgängig gemacht!');
    }},
    { label: '🎯 Tödliche Präzision', cls: 'admin-danger', fn: () => {
      for(let i=1;i<G.numPlayers;i++){
        let bs=0,bv=999;
        for(let s=0;s<G.players[i].cards.length;s++){
          const v=G.players[i].cards[s].type==='number'?G.players[i].cards[s].value:99;
          if(v<bv){bv=v;bs=s;}
        }
        G.players[i].cards[bs]={id:2100+i,type:'number',value:999};
        if(G.players[i].memory)G.players[i].memory[bs]=null;
      }
      setMessage('🎯 Tödliche Präzision: Beste Karte jedes Gegners → Fluchbiber!'); render();
    }},
    { label: '🌈 Regenbogen-Stapel', cls: 'admin-success', fn: () => {
      const rainbow=[-999,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,999];
      for(let i=0;i<rainbow.length;i++)
        G.drawPile.push({id:2200+i,type:'number',value:rainbow[i]});
      setMessage('🌈 Regenbogen: Von −∞ bis +∞ alles auf dem Stapel!'); render();
    }},
    { label: '🏆 Trophäen-Jagd', cls: 'admin-success', fn: () => {
      const h=G.players[me()];
      const sum=h.cards.reduce((a,c)=>a+(c.type==='number'?c.value:0),0);
      if(sum<=0){h.totalScore-=Math.abs(sum)*3;setMessage(`🏆 Handwert ${sum} → Score -${Math.abs(sum)*3}! 3x Bonus!`);}
      else{setMessage(`🏆 Handwert ${sum} – zu hoch für Trophäe! (brauchst ≤0)`);}
      render();
    }},
    { label: '🎪 Extremes Chaos', cls: 'admin-danger', fn: () => {
      for(let i=0;i<3;i++)executeChaosbiber();
      executeTornado();
      for(let i=0;i<2;i++)executeBlitz();
      for(const p of G.players){p.known=[false,false,false,false];if(p.memory)p.memory=[null,null,null,null];}
      G.humanPeekedSlots=[];
      setMessage('🎪 EXTREMES CHAOS! 3x Chaos + Tornado + 2x Blitz + Amnesie!'); render();
    }},
    { label: '💎 Diamantenmine', cls: 'admin-success', fn: () => {
      G.drawPile=[];
      for(let i=0;i<10;i++)G.drawPile.push({id:2300+i,type:'number',value:-999});
      for(let i=0;i<5;i++)G.drawPile.push({id:2310+i,type:'number',value:-3});
      for(let i=0;i<5;i++)G.drawPile.push({id:2320+i,type:'number',value:-2});
      shuffle(G.drawPile);
      setMessage('💎 Diamantenmine! Stapel voller Überbiber + Goldbiber + Eisbiber!'); render();
    }},
    { label: '🕳️ Hölle', cls: 'admin-danger', fn: () => {
      G.drawPile=[];
      for(let i=0;i<10;i++)G.drawPile.push({id:2400+i,type:'number',value:999});
      for(let i=0;i<10;i++)G.drawPile.push({id:2410+i,type:'number',value:9});
      shuffle(G.drawPile);
      setMessage('🕳️ Hölle! Stapel voller Fluchbiber + Neuner!'); render();
    }},
    { label: '⚖️ Yin & Yang', cls: '', fn: () => {
      const h=G.players[me()];
      h.cards[0]={id:2500,type:'number',value:-999}; h.cards[1]={id:2501,type:'number',value:-3};
      h.cards[2]={id:2502,type:'number',value:999}; h.cards[3]={id:2503,type:'number',value:9};
      for(let i=0;i<4;i++)h.known[i]=true;
      G.humanPeekedSlots=[0,1,2,3];
      setMessage('⚖️ Yin & Yang: −∞, -3, +∞, 9 – Gut und Böse vereint!'); render();
    }},
    { label: '🃏 Wildcard', cls: 'admin-warn', fn: () => {
      const vals=[-999,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,999];
      const v=vals[Math.floor(Math.random()*vals.length)];
      let ws=0,wv=-9999;
      const h=G.players[me()];
      for(let s=0;s<h.cards.length;s++){const cv=h.cards[s].type==='number'?h.cards[s].value:99;if(cv>wv){wv=cv;ws=s;}}
      h.cards[ws]={id:2600,type:'number',value:v};h.known[ws]=true;
      G.humanPeekedSlots=h.cards.map((_,i)=>i);
      setMessage(`🃏 Wildcard! Zufälliger Wert: ${v===999?'+∞':v===-999?'−∞':v}! ${v<=0?'GLÜCK!':'Meh...'}`); render();
    }},
    { label: '🌪️ Apokalypse', cls: 'admin-danger', fn: () => {
      for(let i=0;i<3;i++)executeChaosbiber();
      executeTornado();
      for(const p of G.players){
        for(let s=0;s<p.cards.length;s++){
          if(p.cards[s].type==='number')p.cards[s].value=Math.min(999,p.cards[s].value+Math.floor(Math.random()*5));
          p.known[s]=false;if(p.memory)p.memory[s]=null;
        }
      }
      G.humanPeekedSlots=[];
      const h=G.players[me()];
      h.cards[Math.floor(Math.random()*h.cards.length)]={id:2700,type:'number',value:-999};
      setMessage('🌪️ APOKALYPSE! Chaos+Tornado+alle Karten +0-4... aber du hast 1 Überbiber!'); render();
    }},
  ];

  for (const c of cheats) {
    const btn = document.createElement('button');
    btn.className = `admin-btn ${c.cls}`;
    btn.textContent = c.label;
    btn.addEventListener('click', () => { c.fn(); renderAdmin(); });
    row.appendChild(btn);
  }

  sec.appendChild(row);
  return sec;
}

function buildSwapHands() {
  const sec = adminSection('🔀 Hände tauschen');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;';

  const sel1 = document.createElement('select');
  sel1.className = 'admin-card-select';
  sel1.style.width = '90px';
  const sel2 = document.createElement('select');
  sel2.className = 'admin-card-select';
  sel2.style.width = '90px';

  for (let i = 0; i < G.numPlayers; i++) {
    const o1 = document.createElement('option');
    o1.value = i;
    o1.textContent = G.players[i].name;
    sel1.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = i;
    o2.textContent = G.players[i].name;
    if (i === 1) o2.selected = true;
    sel2.appendChild(o2);
  }

  const btn = document.createElement('button');
  btn.className = 'admin-btn admin-warn';
  btn.textContent = 'Tauschen!';
  btn.addEventListener('click', () => {
    const a = parseInt(sel1.value);
    const b = parseInt(sel2.value);
    if (a === b) return;
    const tmpCards = G.players[a].cards;
    const tmpKnown = G.players[a].known;
    G.players[a].cards = G.players[b].cards;
    G.players[a].known = G.players[b].known;
    G.players[b].cards = tmpCards;
    G.players[b].known = tmpKnown;
    if (G.players[a].memory) G.players[a].memory = [null, null, null, null];
    if (G.players[b].memory) G.players[b].memory = [null, null, null, null];
    G.humanPeekedSlots = [];
    render();
    renderAdmin();
  });

  const arrow = document.createElement('span');
  arrow.textContent = '↔';
  arrow.style.cssText = 'font-size:1.2rem;color:var(--gold);';

  row.appendChild(sel1);
  row.appendChild(arrow);
  row.appendChild(sel2);
  row.appendChild(btn);
  sec.appendChild(row);
  return sec;
}

function buildExportImport() {
  const sec = adminSection('💾 Export / Import');

  const expBtn = document.createElement('button');
  expBtn.className = 'admin-btn admin-success';
  expBtn.textContent = '📋 State kopieren';
  expBtn.addEventListener('click', () => {
    const state = {
      G: {
        numPlayers: G.numPlayers, difficulty: G.difficulty,
        players: G.players.map(p => ({
          name: p.name, isHuman: p.isHuman,
          cards: p.cards, known: p.known, memory: p.memory || null,
          totalScore: p.totalScore, roundScores: p.roundScores,
        })),
        drawPile: G.drawPile, discardPile: G.discardPile,
        currentPlayer: G.currentPlayer, phase: G.phase,
        roundNumber: G.roundNumber, totalRounds: G.totalRounds,
        knockedBy: G.knockedBy, lastRoundTurnsLeft: G.lastRoundTurnsLeft,
        skipNextPlayer: G.skipNextPlayer,
      },
      xrayMode, autoPlay,
    };
    navigator.clipboard.writeText(JSON.stringify(state)).then(() => {
      expBtn.textContent = '✅ Kopiert!';
      setTimeout(() => { expBtn.textContent = '📋 State kopieren'; }, 1500);
    });
  });
  sec.appendChild(expBtn);

  const impRow = document.createElement('div');
  impRow.style.cssText = 'margin-top:8px;';
  const ta = document.createElement('textarea');
  ta.style.cssText = 'width:100%;height:60px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:var(--text-light);font-family:monospace;font-size:0.68rem;padding:6px;resize:vertical;';
  ta.placeholder = 'JSON einfügen…';
  impRow.appendChild(ta);

  const impBtn = document.createElement('button');
  impBtn.className = 'admin-btn admin-warn';
  impBtn.style.marginTop = '4px';
  impBtn.textContent = '📥 State laden';
  impBtn.addEventListener('click', () => {
    try {
      const data = JSON.parse(ta.value);
      if (data.G) {
        Object.assign(G, data.G);
        G.diffCfg = DIFF_CONFIG[G.difficulty];
        if (data.xrayMode !== undefined) xrayMode = data.xrayMode;
        if (data.autoPlay !== undefined) autoPlay = data.autoPlay;
        render();
        renderAdmin();
        impBtn.textContent = '✅ Geladen!';
        setTimeout(() => { impBtn.textContent = '📥 State laden'; }, 1500);
      }
    } catch (e) {
      impBtn.textContent = '❌ Fehler!';
      setTimeout(() => { impBtn.textContent = '📥 State laden'; }, 1500);
    }
  });
  impRow.appendChild(impBtn);
  sec.appendChild(impRow);
  return sec;
}

function buildClearData() {
  const sec = adminSection('🗑 Daten löschen');
  const row = document.createElement('div');
  row.className = 'admin-actions';

  const clearHS = document.createElement('button');
  clearHS.className = 'admin-btn admin-danger';
  clearHS.textContent = '🏆 Bestenliste löschen';
  clearHS.addEventListener('click', () => {
    localStorage.removeItem('biberbande_highscores');
    renderHighScores();
    clearHS.textContent = '✅ Gelöscht!';
    setTimeout(() => { clearHS.textContent = '🏆 Bestenliste löschen'; }, 1500);
  });
  row.appendChild(clearHS);

  const clearAll = document.createElement('button');
  clearAll.className = 'admin-btn admin-danger';
  clearAll.textContent = '💣 Alle Daten löschen';
  clearAll.addEventListener('click', () => {
    localStorage.clear();
    renderHighScores();
    clearAll.textContent = '✅ Alles gelöscht!';
    setTimeout(() => { clearAll.textContent = '💣 Alle Daten löschen'; }, 1500);
  });
  row.appendChild(clearAll);

  sec.appendChild(row);
  return sec;
}

// ── Card Reference ──────────────────────────────────────────
const CARD_REFERENCE = [
  { icon: '🌌', name: 'Überbiber', points: '−∞', count: 1, desc: 'DIE LEGENDÄRE KARTE! Zählt -999 Punkte. Wer sie hat, hat quasi gewonnen. Ultra-ultra-mega-selten!' },
  { icon: '👑', name: 'Goldbiber', points: '-3', count: 1, desc: 'Die seltenste Karte im Spiel! Zählt minus 3 Punkte. Ultra-wertvoll!' },
  { icon: '🧊', name: 'Eisbiber', points: '-2', count: 2, desc: 'Sehr wertvolle Karte! Zählt minus 2 Punkte.' },
  { icon: '💎', name: 'Null-Biber', points: '-1', count: 4, desc: 'Wertvolle Karte! Zählt minus 1 Punkt.' },
  { icon: '0️⃣', name: 'Null', points: '0', count: 4, desc: 'Null Punkte – sehr gut!' },
  { icon: '🔢', name: 'Zahlenkarten 1–8', points: '1–8', count: '4 je Wert', desc: 'Zählen ihren aufgedruckten Wert als Punkte.' },
  { icon: '💀', name: 'Neuner', points: '9', count: 9, desc: 'Höchster Wert! Schnell loswerden!' },
  { icon: '☠️', name: 'Fluchbiber', points: '+∞', count: 1, desc: 'DIE VERFLUCHTE KARTE! Zählt +999 Punkte. Wer sie hat, hat quasi verloren. SOFORT LOSWERDEN!' },
  { icon: '👁', name: 'Spähen', points: '–', count: 7, desc: 'Eine eigene Karte ansehen.' },
  { icon: '🔄', name: 'Tausch', points: '–', count: 9, desc: 'Eine eigene Karte blind mit einem Mitspieler tauschen.' },
  { icon: '2️⃣', name: '2× Ziehen', points: '–', count: 5, desc: 'Zwei Karten nacheinander vom Stapel ziehen und nutzen.' },
  { icon: '🌀', name: 'Chaosbiber', points: '–', count: 3, desc: 'Je eine zufällige Karte jedes Spielers wird wild durchgemischt!' },
  { icon: '🕵️', name: 'Spion', points: '–', count: 3, desc: 'Eine Karte eines Mitspielers heimlich ansehen.' },
  { icon: '⚡', name: 'Blitz', points: '–', count: 2, desc: 'Alle Spieler schieben ihre erste Karte nach links weiter.' },
  { icon: '🌪️', name: 'Tornado', points: '–', count: 1, desc: 'ALLE Karten aller Spieler werden komplett neu verteilt! Ultra-selten!' },
  { icon: '❄️', name: 'Freeze', points: '–', count: 2, desc: 'Der nächste Spieler wird übersprungen und verliert seinen Zug.' },
  { icon: '🪞', name: 'Spiegel', points: '–', count: 2, desc: 'Zwei eigene Karten gleichzeitig ansehen – doppelter Durchblick!' },
  { icon: '🦝', name: 'Dieb', points: '–', count: 2, desc: 'Gegner-Karte ansehen und optional gegen eine eigene tauschen!' },
  { icon: '🍀', name: 'Glückspilz', points: '–', count: 2, desc: '3 Karten vom Stapel ziehen und die beste behalten!' },
];

function showCardReference() {
  const grid = document.getElementById('card-ref-grid');
  grid.innerHTML = '';

  for (const ref of CARD_REFERENCE) {
    const item = document.createElement('div');
    item.className = 'card-ref-item';
    item.innerHTML = `
      <div class="card-ref-icon">${ref.icon}</div>
      <div class="card-ref-info">
        <div class="card-ref-name">${ref.name}</div>
        <div class="card-ref-desc">${ref.desc}</div>
        <div class="card-ref-meta">Punkte: <strong>${ref.points}</strong> · Anzahl: <strong>${ref.count}</strong></div>
      </div>
    `;
    grid.appendChild(item);
  }

  document.getElementById('card-ref-overlay').classList.remove('hidden');
}

// ── High Score System ───────────────────────────────────────
function loadHighScores() {
  try { return JSON.parse(localStorage.getItem('biberbande_highscores') || '[]'); }
  catch { return []; }
}

function saveHighScore(name, score, difficulty, numPlayers, won) {
  const diffLabels = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer', impossible: 'Unmöglich' };
  const scores = loadHighScores();
  scores.push({ name, score, difficulty: diffLabels[difficulty] || difficulty, numPlayers, won, date: new Date().toLocaleDateString('de-DE') });
  scores.sort((a, b) => a.score - b.score);
  if (scores.length > 10) scores.length = 10;
  localStorage.setItem('biberbande_highscores', JSON.stringify(scores));
}

function renderHighScores() {
  const container = document.getElementById('highscore-list');
  if (!container) return;
  const scores = loadHighScores();

  if (scores.length === 0) {
    container.innerHTML = '<div class="no-scores">Noch keine Einträge – spiel ein Spiel!</div>';
    return;
  }

  let html = '<table class="highscore-table"><thead><tr><th>#</th><th>Name</th><th>Pkt</th><th>Diff.</th><th>Datum</th></tr></thead><tbody>';
  scores.forEach((s, i) => {
    const cls = s.won ? ' class="hs-winner"' : '';
    html += `<tr${cls}><td>${i + 1}.</td><td>${s.name}${s.won ? ' 🏆' : ''}</td><td>${s.score}</td><td>${s.difficulty}</td><td>${s.date}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ── Start screen logic ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  let selectedPlayers = 3;
  let selectedHumans = 1;
  let selectedDifficulty = 'medium';

  function updateHumanButtons() {
    document.querySelectorAll('.human-count-btn').forEach(btn => {
      const h = parseInt(btn.dataset.humans);
      btn.style.display = h <= selectedPlayers ? '' : 'none';
      if (selectedHumans > selectedPlayers) {
        selectedHumans = selectedPlayers;
      }
      btn.classList.toggle('active', h === selectedHumans);
    });
  }

  document.querySelectorAll('.player-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.player-count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPlayers = parseInt(btn.dataset.count);
      updateHumanButtons();
    });
  });

  document.querySelectorAll('.human-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.human-count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedHumans = parseInt(btn.dataset.humans);
    });
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDifficulty = btn.dataset.diff;
    });
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    newGame(selectedPlayers, selectedDifficulty, selectedHumans);
  });

  updateHumanButtons();

  // Admin panel toggle
  document.getElementById('admin-toggle').addEventListener('click', toggleAdmin);
  document.getElementById('admin-close').addEventListener('click', toggleAdmin);

  // Card reference
  document.getElementById('card-ref-start-btn').addEventListener('click', showCardReference);
  document.getElementById('card-ref-btn').addEventListener('click', showCardReference);
  document.getElementById('card-ref-close').addEventListener('click', () => {
    document.getElementById('card-ref-overlay').classList.add('hidden');
  });

  // High scores on start
  renderHighScores();

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      toggleAdmin();
    }
    if (e.key === 'k' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const overlay = document.getElementById('card-ref-overlay');
      if (overlay.classList.contains('hidden')) {
        showCardReference();
      } else {
        overlay.classList.add('hidden');
      }
    }
  });
});

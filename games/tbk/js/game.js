/* ═══════════════════════════════════════════
   GOODEBAGS CARD GAME — Engine v1.0
═══════════════════════════════════════════ */

/* ── Card Model ── */
class Card {
  constructor(id, name, cost, attack, health, image = '') {
    this.id = id;
    this.name = name;
    this.cost = cost;
    this.attack = attack;
    this.health = health;
    this.maxHealth = health;
    this.image = image;
    this.canAttack = false;
  }
}

/* ── Deck ── */
class Deck {
  constructor(cards) {
    this.cards = [...cards];
    this.discard = [];
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (!this.cards.length) return null;
    return this.cards.pop();
  }

  discardCard(card) {
    this.discard.push(card);
  }
}

/* ── Player ── */
class Player {
  constructor(name, isAi = false) {
    this.name = name;
    this.isAi = isAi;
    this.health = 20;
    this.maxHealth = 20;
    this.mana = 0;
    this.maxMana = 1;
    this.hand = [];
    this.board = [];
    this.deck = null;
  }

  draw(n = 1) {
    for (let i = 0; i < n; i++) {
      const card = this.deck.draw();
      if (card) this.hand.push(card);
    }
  }

  playCard(index) {
    if (index < 0 || index >= this.hand.length) return null;
    const card = this.hand[index];
    if (card.cost > this.mana) return null;
    this.mana -= card.cost;
    this.hand.splice(index, 1);
    card.canAttack = false;
    this.board.push(card);
    return card;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  resetMana() {
    this.maxMana = Math.min(10, this.maxMana + 1);
    this.mana = this.maxMana;
  }
}

/* ── Game Engine ── */
class Game {
  constructor() {
    this.player = new Player('You', false);
    this.ai = new Player('AI', true);
    this.turn = 0; // 0 = player, 1 = ai
    this.log = [];
    this.over = false;
  }

  init() {
    /* ═══════════════════════════════════════════
       TBK CARD DEFINITIONS — 30 real card arts wired in.
       Stats are placeholders — update when gameplay rules arrive.
    ═══════════════════════════════════════════ */
    const cards = [
      new Card(1,  'TBK #1',   1, 1, 2, 'assets/cards/TBK-1.png'),
      new Card(2,  'TBK #2',   1, 2, 1, 'assets/cards/TBK-2.png'),
      new Card(3,  'TBK #3',   1, 2, 2, 'assets/cards/TBK-3.png'),
      new Card(4,  'TBK #4',   2, 2, 3, 'assets/cards/TBK-4.png'),
      new Card(5,  'TBK #5',   1, 1, 2, 'assets/cards/TBK-5.png'),
      new Card(6,  'TBK #6',   2, 3, 2, 'assets/cards/TBK-6.png'),
      new Card(7,  'TBK #7',   1, 2, 1, 'assets/cards/TBK-7.png'),
      new Card(8,  'TBK #8',   2, 2, 4, 'assets/cards/TBK-8.png'),
      new Card(9,  'TBK #9',   2, 3, 3, 'assets/cards/TBK-9.png'),
      new Card(10, 'TBK #10',  1, 2, 1, 'assets/cards/TBK-10.png'),
      new Card(11, 'TBK #11',  3, 4, 3, 'assets/cards/TBK-11.png'),
      new Card(12, 'TBK #12',  2, 2, 3, 'assets/cards/TBK-12.png'),
      new Card(13, 'TBK #13',  1, 1, 3, 'assets/cards/TBK-13.png'),
      new Card(14, 'TBK #14',  2, 3, 2, 'assets/cards/TBK-14.png'),
      new Card(15, 'TBK #15',  3, 3, 4, 'assets/cards/TBK-15.png'),
      new Card(16, 'TBK #16',  1, 2, 1, 'assets/cards/TBK-16.png'),
      new Card(17, 'TBK #17',  2, 2, 3, 'assets/cards/TBK-17.png'),
      new Card(18, 'TBK #18',  2, 3, 2, 'assets/cards/TBK-18.png'),
      new Card(19, 'TBK #19',  3, 4, 3, 'assets/cards/TBK-19.png'),
      new Card(20, 'TBK #20',  4, 5, 5, 'assets/cards/TBK-20.png'),
      new Card(21, 'TBK #21',  1, 1, 2, 'assets/cards/TBK-21.png'),
      new Card(22, 'TBK #22',  2, 3, 2, 'assets/cards/TBK-22.png'),
      new Card(23, 'TBK #23',  2, 2, 4, 'assets/cards/TBK-23.png'),
      new Card(24, 'TBK #24',  3, 4, 3, 'assets/cards/TBK-24.png'),
      new Card(25, 'TBK #25',  1, 2, 1, 'assets/cards/TBK-25.png'),
      new Card(26, 'TBK #26',  2, 3, 3, 'assets/cards/TBK-26.png'),
      new Card(27, 'TBK #27',  2, 2, 3, 'assets/cards/TBK-27.png'),
      new Card(28, 'TBK #28',  3, 4, 4, 'assets/cards/TBK-28.png'),
      new Card(29, 'TBK #29',  1, 1, 2, 'assets/cards/TBK-29.png'),
      new Card(30, 'TBK #30',  2, 3, 2, 'assets/cards/TBK-30.png'),
    ];

    this.player.deck = new Deck([...cards]);
    this.ai.deck = new Deck([...cards]);

    this.player.draw(3);
    this.ai.draw(3);
    this.player.mana = 1;
    this.ai.mana = 0;
    this.turn = 0;
    this.render();
  }

  endTurn() {
    if (this.over) return;
    // Reset attack flags for current player's board
    const current = this.turn === 0 ? this.player : this.ai;
    current.board.forEach(c => c.canAttack = true);

    this.turn = this.turn === 0 ? 1 : 0;
    const next = this.turn === 0 ? this.player : this.ai;
    next.resetMana();
    next.draw();
    this.log.push(`${next.name}'s turn begins. Mana: ${next.mana}`);

    if (next.isAi) {
      setTimeout(() => this.aiTurn(), 600);
    }
    this.render();
  }

  aiTurn() {
    if (this.over || this.turn !== 1) return;
    const ai = this.ai;

    // Play cards from hand if affordable
    for (let i = ai.hand.length - 1; i >= 0; i--) {
      if (ai.hand[i].cost <= ai.mana) {
        ai.playCard(i);
        this.log.push(`AI plays ${ai.board[ai.board.length - 1].name}`);
      }
    }

    // Attack with all board cards
    ai.board.forEach(card => {
      if (this.player.board.length > 0) {
        const target = this.player.board[Math.floor(Math.random() * this.player.board.length)];
        target.health -= card.attack;
        this.log.push(`AI ${card.name} attacks ${target.name} for ${card.attack}`);
        if (target.health <= 0) {
          this.player.board = this.player.board.filter(c => c !== target);
          this.player.deck.discardCard(target);
          this.log.push(`${target.name} destroyed`);
        }
      } else {
        this.player.takeDamage(card.attack);
        this.log.push(`AI ${card.name} attacks you for ${card.attack}`);
      }
    });

    this.checkWin();
    if (!this.over) {
      setTimeout(() => this.endTurn(), 400);
    }
    this.render();
  }

  playerAttack(cardIndex, targetType, targetIndex = 0) {
    if (this.over || this.turn !== 0) return;
    const card = this.player.board[cardIndex];
    if (!card || !card.canAttack) return;

    if (targetType === 'player') {
      this.ai.takeDamage(card.attack);
      this.log.push(`Your ${card.name} attacks AI for ${card.attack}`);
    } else if (targetType === 'board') {
      const target = this.ai.board[targetIndex];
      if (!target) return;
      target.health -= card.attack;
      this.log.push(`Your ${card.name} attacks ${target.name} for ${card.attack}`);
      if (target.health <= 0) {
        this.ai.board = this.ai.board.filter(c => c !== target);
        this.ai.deck.discardCard(target);
        this.log.push(`${target.name} destroyed`);
      }
    }
    card.canAttack = false;
    this.checkWin();
    this.render();
  }

  checkWin() {
    if (this.player.health <= 0) {
      this.over = true;
      this.log.push('AI wins!');
    } else if (this.ai.health <= 0) {
      this.over = true;
      this.log.push('You win!');
    }
  }

  /* ── Rendering ── */
  render() {
    // Health
    this.setHealth('player', this.player.health, this.player.maxHealth);
    this.setHealth('ai', this.ai.health, this.ai.maxHealth);

    // Mana
    document.getElementById('manaText').textContent =
      `Mana: ${this.player.mana} / ${this.player.maxMana}`;

    // Deck counts
    document.getElementById('deckCount').textContent = this.player.deck.cards.length;
    document.getElementById('discardCount').textContent = this.player.deck.discard.length;

    // Turn badge
    const badge = document.getElementById('turnIndicator');
    badge.textContent = this.turn === 0 ? 'Your Turn' : "AI's Turn";

    // Hands
    this.renderHand(this.player.hand, 'playerHand', true);
    this.renderHand(this.ai.hand, 'aiHand', false);

    // Boards
    this.renderBoard(this.player.board, 'playerBoard', true);
    this.renderBoard(this.ai.board, 'aiBoard', false);

    // Log
    const logEl = document.getElementById('battleLog');
    logEl.innerHTML = this.log.slice(-8).map(m => `<div class="log-entry">${m}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  setHealth(id, hp, max) {
    const pct = (hp / max) * 100;
    document.getElementById(`${id}Health`).style.width = `${pct}%`;
    document.getElementById(`${id}HealthText`).textContent = `${hp} / ${max}`;
  }

  renderHand(hand, containerId, isPlayer) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    hand.forEach((card, idx) => {
      const node = document.createElement('div');
      node.className = 'card';
      const imgHtml = card.image ? `<img src="${card.image}" alt="${card.name}" loading="lazy" onerror="this.style.display='none'">` : '';
      if (isPlayer) {
        node.innerHTML = `
          ${imgHtml}
          <div class="card-cost">${card.cost}</div>
          <div class="card-name">${card.name}</div>
          <div class="card-stats"><span class="stat-atk">${card.attack}</span><span class="stat-hp">${card.health}</span></div>
        `;
        if (card.cost <= this.player.mana && this.turn === 0) {
          node.classList.add('playable');
        }
        node.addEventListener('click', () => {
          if (this.turn === 0 && !this.over) {
            const played = this.player.playCard(idx);
            if (played) {
              this.log.push(`You play ${played.name}`);
              this.render();
            }
          }
        });
      }
      el.appendChild(node);
    });
  }

  renderBoard(board, containerId, isPlayer) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    board.forEach((card, idx) => {
      const node = document.createElement('div');
      node.className = 'card' + (card.canAttack ? ' can-attack' : '');
      const imgHtml = card.image ? `<img src="${card.image}" alt="${card.name}" loading="lazy" onerror="this.style.display='none'">` : '';
      node.innerHTML = `
        ${imgHtml}
        <div class="card-cost">${card.cost}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-stats"><span class="stat-atk">${card.attack}</span><span class="stat-hp">${card.health}</span></div>
      `;
      if (isPlayer && this.turn === 0 && card.canAttack && !this.over) {
        node.addEventListener('click', () => {
          if (this.ai.board.length > 0) {
            this.playerAttack(idx, 'board', 0);
          } else {
            this.playerAttack(idx, 'player');
          }
        });
      }
      el.appendChild(node);
    });
  }
}

/* ── Bootstrap ── */
const game = new Game();
game.init();

document.getElementById('endTurnBtn').addEventListener('click', () => game.endTurn());
document.getElementById('restartBtn').addEventListener('click', () => game.init());

import { usePeerService } from '@/composables/peer';
import router from '@/router';
import { useRafFn, useThrottleFn, type PromisifyFn } from '@vueuse/core';
import { klona } from 'klona';
import { ref, triggerRef, watch, type Ref } from "vue";
import type { Router } from 'vue-router';
import type { PeerService } from '../peer';
import type { InitialSyncMessage, PeerContext, StartGameMessage } from '../peer/data_handlers/types';
import { PeerServiceHook } from '../peer/types';
import { ECS, Entity, type EntityMap } from "./ecs";
import { AliveComponent, AppearanceComponent, HiddenComponent, MapComponent, PositionComponent, PositionListComponent } from "./ecs/components";
import { MouseHelper, SinglePosition } from "./ecs/pathfinding";
import { GameStatus, type GameContext, type GameSettings } from './types';

function genGameState(): GameState {
  return {
    players: {},
    opponents: {}
  };
}

export class GameService {
  logTag = "[GameService]";
  _settings: GameSettings;
  context: GameContext = {} as GameContext;
  gameFinished = ref(false);
  peerService?: PeerService;
  entitySystem: ECS;
  map: MapComponent = new MapComponent();
  numberOfMice: number;

  currentState: Ref<GameState> = ref(genGameState());
  stateBuffer: GameState = genGameState();
  mouseHelper: MouseHelper;
  counter = 0;
  killCount = ref(0);
  winCount = ref(0);
  _router?: Router;

  _multiplayerUpdater?: PromisifyFn<() => void>;

  gameLoopPlayer = useRafFn(this._gameLoop.bind(this), { immediate: false });

  constructor(entitySystem?: ECS, settings?: GameSettings) {
    this._settings = settings ?? { multiplayer: false, networked: false };
    this.mouseHelper = new MouseHelper();
    this.numberOfMice = this.mouseHelper.getNumberOfMice();
    this.entitySystem = entitySystem ?? new ECS(this.numberOfMice);
    this.map.init();

    window.addEventListener("pagehide", () => {
      this.gameLoopPlayer.pause();
    });

    router.beforeEach((to, from, next) => {
      if (from.name === "multiplayer_game" && to.name !== "multiplayer_game") {
        this._disposeService();
      }
      next();
    });
  }

  restartGame(players?: string[]) {
    // cleanup old ECS and state
    this.winCount.value = 0;
    this.killCount.value = 0;
    this.gameFinished.value = false;
    this.map.init();
    this.entitySystem = new ECS(this.numberOfMice);
    this.currentState.value = genGameState();

    this.startGame(players);
  }

  _disposeService() {
    this.gameLoopPlayer.pause();
    this.entitySystem = new ECS(this.numberOfMice);
  }

  async updateOpponentPosition() {
    for (let i = 0; i < this.numberOfMice; i++) {
      const mouse = this.currentState.value.opponents[i.toString()];
      if (this.entitySystem.isAlive(mouse.id)) {
        await this.mouseHelper.updateMousePosition(mouse, this.map);
      }
    }
  }

  initMultiplayer() {
    const { peerService } = usePeerService();
    this.peerService = peerService.value;

    if (this._settings.multiplayer && this._settings.networked) {
      if (this.peerService!.lobbySettings.lobbyId === null) {
        throw new Error(this.logTag + " Cannot start game without lobbyId");
      }

      if (!this.peerService!.peer) {
        return;
      }

      this.context.gameId = this.peerService!.lobbySettings.lobbyId;

      // console.log(settings.lobbyId, this.peerService!.peer.value!.id, this.context.value.gameId === this.peerService!.peer.value!.id)
      if (this.context.gameId === this.peerService!.peer!.id) {
        // user is host
        this.peerService!.dataHandler!.registerHandler("sync_ack", this._handleInitialSyncAck.bind(this));
        this._checkWinCondition();
      } else {
        this.peerService!.dataHandler!.registerHandler("initial_state_sync", this._handleInitialSync.bind(this));
      }

      this._router = router;

      this._multiplayerUpdater = useThrottleFn(this._updatePeers, 30);
    }
  }

  /**
   * Send an update event to all registered peers.
   * Note: Currently only the position of the own player will be sent, solving two issues:
   *   - Saves bandwidth
   *   - Prevents state collision, when eg. peers send different positions for one player
   * @returns void
   */
  _updatePeers() {
    this.peerService!.send({
      type: "update",
      value: {
        players: { [this.peerService!.peer!.id]: this.stateBuffer.players[this.peerService!.peer!.id] }
      }
    });
  }

  startGame(players?: string[]) {
    this.currentState.value = {
      players: this.generatePlayers(players),
      opponents: this.generateOpponents()
    };

    if (this._settings.multiplayer && this._settings.networked) {
      this.peerService!.setHook(PeerServiceHook.PEER_CONNECTION, (connection) => {
        if (this.context.status === GameStatus.started && !this.context.players![connection.peer]) {
          console.error(this.logTag + " Peer cannot connect to game, game is already running");
          // todo: maybe emitting an event would also help, haven't tested it yet
          // connection.emit("game_error", "Game is already running");
          connection.removeAllListeners();
          connection.close();
          return false;
        }
        return true;
      });


      if (this.peerService?.peer) {
        // set the players for the current game and set their ready state to false, 
        // will be set to true after they ack'ed the initial sync
        this.context.players = this.peerService!.peerConnections.map((conn) => (
          { [conn.peer]: { id: conn.peer, ready: false } })).reduce((acc, curr) => ({ ...acc, ...curr }), {});
        // send start game event through the peerService
        this.peerService!.send({
          type: "initial_state_sync",
          value: this.currentState.value
        })
      }
    } else {
      // if we are not in a multiplayer game we can just start the game
      this.context.status = GameStatus.started;
      this._checkWinCondition();
      this.gameLoopPlayer.resume();
    }
  }

  pauseGame() {
    if (this._settings.multiplayer && this._settings.networked) {
      this.peerService!.send({
        type: "pause_game",
      });
    }

    this.gameLoopPlayer.pause();
    this.context.status = GameStatus.paused;
  }

  resumeGame() {
    if (this._settings.multiplayer && this._settings.networked) {
      this.peerService!.send({
        type: "resume_game",
      });
    }

    this.gameLoopPlayer.resume();
    this.context.status = GameStatus.started;
  }


  generatePlayers(players: string[] = []): EntityMap {
    const entities: EntityMap = {};
    for (const playerId of players) {
      const ent = this.entitySystem.createEntity(playerId);
      ent.addComponent(new AppearanceComponent(), { shape: 'cat' });
      ent.addComponent(new PositionComponent('pos'), { x: 50, y: 50 });
      // todo: add a collision component, to know when mice collide with cats
      // ent.addComponent(new CollisionComponent());

      entities[ent.id] = ent;
    }
    return entities;
  }

  generateOpponents(): EntityMap {
    const entities: EntityMap = {};
    for (let i = 0; i < this.numberOfMice; ++i) {
      const ent = this.entitySystem.createEntity(i.toString());
      ent.addComponent(new AppearanceComponent(), { shape: 'mouse' });
      ent.addComponent(new PositionComponent('pos'), { x: this.mouseHelper.getInitialMouseX(), y: this.mouseHelper.getInitialMouseY() });
      ent.addComponent(new PositionListComponent('targetList'), this.generateMouseGoalList()); // getRandomPathStrategy
      ent.addComponent(new AliveComponent(), true);
      ent.addComponent(new HiddenComponent());
      entities[ent.id] = ent;
    }
    return entities;
  }

  randomIntFromInterval(min: number, max: number) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
  }

  generateMouseGoalList(): SinglePosition[] {
    const positionList = [];
    positionList.push(new SinglePosition(85, 10));
    // final goal goes first
    positionList.push(new SinglePosition(this.randomIntFromInterval(0, 99), this.randomIntFromInterval(0, 99))); // each mouse gets a random valid goal
    const random = this.randomIntFromInterval(1, 3);
    if (random == 1) {
      //PathStrategies.speedRunner
    } else if (random == 2) {
      //PathStrategies.chicken
      positionList.push(new SinglePosition(85, 10)); //TODO: implement?
    }
    else if (random == 3) {
      //PathStrategies.tourist
      positionList.push(new SinglePosition(60, 30));
      positionList.push(new SinglePosition(60, 10));
      positionList.push(new SinglePosition(40, 20));
      positionList.push(new SinglePosition(40, 90));
      positionList.push(new SinglePosition(20, 80));
      positionList.push(new SinglePosition(20, 10));

    }
    return positionList;
  }

  /**
   * This method emits an event to the state buffer, which will later be flushed when syncing
   * @param entityId ID of the player entity
   * @param event the type of event that should be emitted
   * @param payload 
   * @returns void
   */
  async emit(entityId: string, event: string, payload?: any) {
    // console.log("emiting event", entityId, event, payload);
    if (this.stateBuffer.players === undefined) {
      this.stateBuffer.players = {};
    }

    if (this.stateBuffer.players[entityId] === undefined) {
      this.stateBuffer.players[entityId] = klona(this.currentState.value.players[entityId]);
    }
    const entity = this.stateBuffer.players[entityId];
    if (!entity) {
      console.warn(`${this.logTag} Entity with ID ${entityId} not found`);
      return;
    }

    switch (event) {
      case "move":
        this._handleMove(entity, payload);
        break;
    }

    this.stateBuffer.players[entityId] = entity;
  }

  checkBorder(x: number, y: number) {
    if (this.map.map![x] == undefined) {
      return false;
    }
    if (this.map.map![x][y] == undefined) {
      return false;
    }
    return true;
  }

  _handleMove(entity: Entity, payload: string) {
    const pos = entity.getComponent<PositionComponent>("pos");
    switch (payload) {
      case "up":
        if (!this.checkBorder(pos.x!, pos.y! - 1)) {
          break;
        }
        pos.y = pos.y! - 1;
        break;
      case "right":
        if (!this.checkBorder(pos.x! + 1, pos.y!)) {
          break;
        }
        pos.x = pos.x! + 1;
        break;
      case "left":
        if (!this.checkBorder(pos.x! - 1, pos.y!)) {
          break;
        }
        pos.x = pos.x! - 1;
        break;
      case "down":
        if (!this.checkBorder(pos.x!, pos.y! + 1)) {
          break;
        }
        pos.y = pos.y! + 1;
        break;
      default:
        console.warn(`${this.logTag} Unknown direction ${payload}`);
    }

  }

  checkCollision(x: number, y: number) {
    if (y >= 0 && y < 100 && x >= 0 && x < 100) {
      // i changed the x and y coordinates in the call below to fix the collision detection on the field.
      const adjecent = this.getAdjacent(this.map.map!, y, x);
      for (let i = 0; i < adjecent.length; i++) {
        const cell = adjecent[i];
        if (cell.occupied !== null && cell.occupied.getComponent<HiddenComponent>("hidden").hidden === false) {
          if (cell.occupied!.getComponent<AppearanceComponent>("ap").shape === "mouse" && cell.occupied!.getComponent<AliveComponent>("isAlive").isAlive === true) {
            const i = cell.occupied!.id;
            const mouse = this.currentState.value.opponents[i!.toString()];
            this.killCount.value += this.mouseHelper.killMouse(mouse);
            if (this._settings.multiplayer && this._settings.networked) {
              this.peerService!.send({
                type: "kill",
                value: i
              });
            }
          }
        }
      }
    }
  }

  isValidPos(i: number, j: number, n: number, m: number) {
    if (i < 0 || j < 0 || i > n - 1 || j > m - 1)
      return 0;
    return 1;
  }


  getAdjacent<T>(arr: T[][], i: number, j: number): T[] {
    const n = arr.length;
    const m = arr[0].length;
    const v = [];

    // blatently add the own position as well without checking
    v.push(arr[i][j]);

    if (this.isValidPos(i - 1, j - 1, n, m))
      v.push(arr[i - 1][j - 1]);
    if (this.isValidPos(i - 1, j, n, m))
      v.push(arr[i - 1][j]);
    if (this.isValidPos(i - 1, j + 1, n, m))
      v.push(arr[i - 1][j + 1]);
    if (this.isValidPos(i, j - 1, n, m))
      v.push(arr[i][j - 1]);
    if (this.isValidPos(i, j + 1, n, m))
      v.push(arr[i][j + 1]);
    if (this.isValidPos(i + 1, j - 1, n, m))
      v.push(arr[i + 1][j - 1]);
    if (this.isValidPos(i + 1, j, n, m))
      v.push(arr[i + 1][j]);
    if (this.isValidPos(i + 1, j + 1, n, m))
      v.push(arr[i + 1][j + 1]);

    return v;
  }

  _checkWinCondition() {
    watch([this.winCount, this.killCount], () => {
      if (this.winCount.value + this.killCount.value === this.numberOfMice) {
        console.log("you are doone!");
        this.gameFinished.value = true;
        if (this._settings.multiplayer && this._settings.networked) {
          this.peerService!.send({
            type: "game_over"
          });
        }
      }
    })
  }

  async _gameLoop() {
    if (this.gameFinished.value === true) {
      this.gameLoopPlayer.pause();
      return;
    }

    this.counter++;
    if (this.counter % 7 === 0) {
      this.counter = 0;

      let playerPos;
      if (this._settings.multiplayer && this._settings.networked) {
        playerPos = this.currentState.value.players[this.peerService!.peer!.id].getComponent<PositionComponent>("pos");
      } else {
        playerPos = this.currentState.value.players["singleplayer"].getComponent<PositionComponent>("pos");
      }

      this.checkCollision(playerPos.x!, playerPos.y!);

      await this.updateOpponentPosition();
      this.winCount.value = this.mouseHelper.getMouseWinCounter();
    }

    if ((this.stateBuffer.players !== undefined && Object.keys(this.stateBuffer.players).length > 0)) {
      if (this._settings.multiplayer && this._settings.networked && this.stateBuffer.players[this.peerService!.peer!.id] !== undefined) {
        // this currently updates only the current users position
        this._multiplayerUpdater!();
      }
      this._updateEntityMap(this.currentState.value.players, this.stateBuffer.players);

    }

    this.stateBuffer = genGameState();

    triggerRef(this.currentState);
  }

  /**
   * Handles the initial sync of the given data, sending the host an ack message, when we
   * successfully imported the game state.
   * @param context Provides access to the peerService and the senderId
   * @param data a sync ack message with no additional data
   * @returns -
   */
  async _handleInitialSync(context: PeerContext, data: InitialSyncMessage) {
    console.log(this.logTag + " handling initial sync");
    const players = this.entitySystem.importEntities(data.value.players);
    const opponents = this.entitySystem.importEntities(data.value.opponents);

    this.currentState.value = {
      players,
      opponents
    };

    const host = context.peerService.peerConnections.filter((conn) => conn.peer === context.peerService.lobbySettings.lobbyId)[0];

    if (!host) {
      console.error(this.logTag + " Cannot find host connection");
    }

    this.context.status = GameStatus.started;
    await this._router!.push({ name: "multiplayer_game", params: { gameId: this.context.gameId } });

    host.send({
      type: "sync_ack"
    });

    this.peerService!.dataHandler!.removeHandler("initial_state_sync");
    this.peerService!.dataHandler!.registerHandler("start_game", this._handleStartGame.bind(this));
  }

  /**
   * Handles an ack from a peer, when they successfully imported the game state.
   * Will check if all players in the given game context are ready and start the game if so.
   * @param context Provides access to the peerService and the senderId
   * @param data a sync ack message with no additional data
   * @returns -
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async _handleInitialSyncAck(context: PeerContext, data: { type: "sync_ack" }) {
    // todo check if all peers in the game have sent an ack
    // if so, send the `start_game` event to the peers

    if (!this.context.players) {
      return;
    }

    const player = this.context.players[context.senderId];
    if (!player) {

      console.warn(this.logTag + " Got initial handle async from peer id: " + context.senderId + " but no player was found in context");
      return;
    }

    player.ready = true;

    if (Object.values(this.context.players!).every((player) => player.ready === true)) {
      this.context.status = GameStatus.started;
      await this._router!.push({ name: "multiplayer_game", params: { gameId: this.context.gameId } });
      // send start game event
      this.peerService!.send({
        type: "start_game",
        value: this.context.gameId
      });
      this._registerInGameHandlers();
      this.gameLoopPlayer.resume();
    }
  }

  _registerInGameHandlers() {
    this.peerService!.dataHandler!.registerHandler("pause_game", this._handlePauseGame.bind(this));
    this.peerService!.dataHandler!.registerHandler("resume_game", this._handleResumeGame.bind(this));
    this.peerService!.dataHandler!.registerHandler("update", this._handleUpdate.bind(this));
    this.peerService!.dataHandler!.registerHandler("kill", this._handleKillMouse.bind(this));
    this.peerService!.dataHandler!.registerHandler("game_over", this._handleGameEnd.bind(this));
  }

  /**
   * Handles the start game event, which will require the game service hooks 
   * for start game to run and finish successfully, and only then start the game loop
   * @param context Provides access to the peerService and the senderId
   * @param data -
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async _handleStartGame(context: PeerContext, data: StartGameMessage) {
    console.log(this.logTag + " Starting gaame");

    this._registerInGameHandlers();
    // this.context.value.status = GameStatus.started;
    this.gameLoopPlayer.resume();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async _handlePauseGame(context: PeerContext, data: any) {
    console.log(this.logTag + " Pausing game");

    this.context.status = GameStatus.paused;
    this.gameLoopPlayer.pause();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async _handleResumeGame(context: PeerContext, data: any) {
    console.log(this.logTag + " Resuming game");

    this.context.status = GameStatus.started;
    this.gameLoopPlayer.resume();
  }

  async _handleUpdate(context: PeerContext, data: { type: "update", value: GameState }) {
    // an update contains new players positions and we should update them directly in our current state
    // at the moment the mice won't be updated
    const updatePlayers = data.value.players;

    this._updateEntityMap(this.stateBuffer.players, updatePlayers, true);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async _handleKillMouse(context: PeerContext, data: { type: 'kill', value: number | string }) {
    this.currentState.value.opponents[data.value.toString()].getComponent<AliveComponent>("isAlive").isAlive = false;
    this.killCount.value += 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async _handleGameEnd(context: PeerContext, data: { type: 'game_over' }) {
    console.log("got game over");
    this.gameFinished.value = true;
  }

  _updateEntityMap(ents: EntityMap, updated: EntityMap, createMode: boolean = false) {
    // console.log("updating entity map", updated);
    const ids = Object.keys(updated);
    for (let i = 0; i < ids.length; ++i) {
      if (!ents[ids[i]]) {
        if (!createMode) {
          console.warn(`${this.logTag} Entity with ID ${ids[i]} not found`);
          continue;
        }
        ents[ids[i]] = Entity.fromJson(updated[ids[i]]);
      }

      ents[ids[i]].components = updated[ids[i]].components;
    }
  }
}

export type GameState = {
  //entities: EntityMap,
  players: EntityMap,
  opponents: EntityMap
}

enum PathStrategies {
  speedRunner,
  chicken,
  tourist
}
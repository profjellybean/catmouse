import type { Entity } from ".";
import type { AliveComponent, PositionComponent } from "./components";
import type { MapComponent } from "./components";
import type { Ref } from "vue";

export class MouseHelper {
    private numberOfMice: number = 25;
    private mouseWinCounter: number = 0;
    private map: Ref<MapComponent>;

    private mousePos?: Pos;
    private goalPos?: Pos;

    constructor(map: Ref<MapComponent>) {
        this.map = map;
    }



    async updateMousePosition(mouse: Entity): Promise<void> {
        return new Promise((resolve, reject) => {
            this.mousePos = new Pos(mouse.getComponent<PositionComponent>("pos").x, mouse.getComponent<PositionComponent>("pos").y);
            this.goalPos = new Pos(mouse.getComponent<PositionComponent>("goal").x, mouse.getComponent<PositionComponent>("goal").y);

            const newPos = this.calcStep();

            this.map.value.map![this.mousePos!.x!][this.mousePos!.y!].occupied = null;
            this.map.value.map![newPos.x!][newPos.y!].occupied = mouse;

            if (newPos.x === this.goalPos.x && newPos.y === this.goalPos.y || this.mousePos!.x === this.goalPos!.x && this.mousePos!.y === this.goalPos!.y) {
                mouse.getComponent<AliveComponent>("isAlive").isAlive = false;
                this.mouseWinCounter++;
                resolve();
            }

            mouse.getComponent<PositionComponent>("pos").x = newPos.x;
            mouse.getComponent<PositionComponent>("pos").y = newPos.y;

            resolve();
        });
    }

    getInitialMouseX(): number {
        return Math.floor(Math.random() * 100);
    }

    getInitialMouseY(): number {
        return Math.floor(Math.random() * 100);
    }


    calcStep(): Pos {
        /*const deltaX = this.mousePos!.x! - this.goalPos!.x!;
        const deltaY = this.mousePos!.y! - this.goalPos!.y!;
        const directPath = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
        if (this.mouseStepSize > directPath) {
            // Destination Reached
            return new Pos(undefined, undefined)
        }
        const numberOfSteps = directPath / this.mouseStepSize;
        const stepX = deltaX / numberOfSteps;
        const stepY = deltaY / numberOfSteps;

        return new Pos(Math.floor(this.mousePos!.x! - stepX), Math.floor(this.mousePos!.y! - stepY));*/

        const deltaX = this.mousePos!.x! - this.goalPos!.x!;
        const deltaY = this.mousePos!.y! - this.goalPos!.y!;

        if (deltaX > 0) {
            if (deltaY > 0) {
                return new Pos(this.mousePos!.x! - 1, this.mousePos!.y! - 1)
            } else {
                return new Pos(this.mousePos!.x! - 1, this.mousePos!.y! + 1)
            }
        } if (deltaX < 0) {
            if (deltaY > 0) {
                return new Pos(this.mousePos!.x! + 1, this.mousePos!.y! - 1)
            } else {
                return new Pos(this.mousePos!.x! + 1, this.mousePos!.y! + 1)
            }
        } else {
            if (deltaY > 0) {
                return new Pos(this.mousePos!.x!, this.mousePos!.y! - 1)
            } else {
                return new Pos(this.mousePos!.x!, this.mousePos!.y! + 1)
            }
        }
    }

    getNumberOfMice(): number {
        return this.numberOfMice;
    }

    getMouseWinCounter(): number {
        return this.mouseWinCounter;
    }
}

class Pos {
    x?: number;
    y?: number;

    constructor(xVal?: number, yVal?: number) {
        this.x = xVal;
        this.y = yVal;
    }
}
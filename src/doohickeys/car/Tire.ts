import { Mesh, TransformNode, Vector3 } from "@babylonjs/core";

export default class Tire extends TransformNode {
    canThrust
    canRotate
    gripSpeedKmh
    fastGrip
    slowGrip
    mesh

    constructor(options: {
        canThrust: boolean,
        canRotate: number,
        gripSpeed: number,
        fastGrip: number,
        slowGrip: number,
        position: Vector3,
        mesh: Mesh,
    }) {
        super("tire");

        this.canThrust = options.canThrust
        this.canRotate = options.canRotate

        this.gripSpeedKmh = options.gripSpeed
        this.fastGrip = options.fastGrip
        this.slowGrip = options.slowGrip
        
        this.position = options.position
        this.mesh = options.mesh

        this.addChild(this.mesh)

        this.mesh.position = Vector3.Zero()
    }
}
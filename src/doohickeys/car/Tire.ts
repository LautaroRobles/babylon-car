import { Mesh, TransformNode, Vector3 } from "@babylonjs/core";

export default class Tire extends TransformNode {
    options

    constructor(options: {
        canThrust: boolean,
        canRotate: boolean,
        gripFactor: number,
        position: Vector3,
        mesh: Mesh,
    }) {
        super("tire");

        this.position = options.position
        this.addChild(options.mesh)

        options.mesh.position = Vector3.Zero()

        this.options = options
    }
}
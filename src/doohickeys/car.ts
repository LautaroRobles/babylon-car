import { Color3, DeviceSourceManager, DeviceType, Engine, Mesh, MeshBuilder, PhysicsAggregate, PhysicsBody, PhysicsRaycastResult, PhysicsShapeType, PointerInput, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import { IPhysicsEngine } from "@babylonjs/core/Physics/IPhysicsEngine";

export default class Car {
    physicsEngine: IPhysicsEngine
    scene: Scene
    deviceSourceManager: DeviceSourceManager

    car: Mesh
    carBody: PhysicsBody
    tires: Mesh[]

    size = 2
    width = 3
    height = 1

    tireRadius = 0.5
    suspensionRestDistance = 0.25
    suspensionStrength = 20000
    suspensionDamp = 1000
    mass = 1000

    constructor(scene: Scene, engine: Engine, position: Vector3) {
        this.scene = scene
        this.deviceSourceManager = new DeviceSourceManager(engine)
        this.physicsEngine = scene.getPhysicsEngine()!!

        // Modelo y fisicas del auto
        this.car = MeshBuilder.CreateBox("car", { width: this.width, height: this.height, size: this.size })
        this.car.position = position
        this.carBody = new PhysicsAggregate(this.car, PhysicsShapeType.BOX, { mass: this.mass, restitution: 0.1}, scene).body;

        // Ruedas
        let tireMaterial = new StandardMaterial("tireMaterial")
        tireMaterial.diffuseColor = new Color3(0.5, 1, 1)

        this.tires = []
        for (let i = 0; i < 4; i++) {

            // ???
            let zSign = i % 2 == 0 ? 1 : -1
            let xSign = i < 2 ? 1 : -1

            this.tires[i] = MeshBuilder.CreateDisc("tire", { radius: this.tireRadius, tessellation: 16 })
            this.tires[i].position = this.car.position.add(new Vector3(this.width / 2 * xSign, this.height / 2 - 1, this.size / 2 * zSign))
            this.tires[i].material = tireMaterial

            this.car.addChild(this.tires[i])
        }
    }

    /**
     * Obtiene la posicion global de un child de car
     * @param child
     * @returns 
     */
    globalPosition(child: TransformNode): Vector3 {
        return this.car.position.add(child.position)
    }

    transformVector(vector: Vector3): Vector3 {
        let worldMatrix = this.car.computeWorldMatrix();
        return Vector3.TransformNormal(vector, worldMatrix);
    }

    tireRay(tire: Mesh) {
        let start = tire.getAbsolutePosition()
        let end = tire.getAbsolutePosition().add(this.transformVector(new Vector3(0, -this.tireRadius, 0)))
        return this.physicsEngine.raycast(start, end)
    }

    applySuspensionForce(tire: Mesh, tireRay: PhysicsRaycastResult)
	{
		// Up direction relative to the tire
		let tireUp = this.transformVector(Vector3.Up())

		// Get the velocity for the tire
		let tireVelocity = this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(tire.position))

		// Get the velocity proyected on to the tire direction
		let velocity = tireUp.dot(tireVelocity)

		// Calculate offset of the tire relative to the rest position of the suspension
		let offset = tireRay.hitDistance - this.suspensionRestDistance

		// Calculate the force to be applied
		let force = - (offset * this.suspensionStrength) - (velocity * this.suspensionDamp)

        this.carBody.applyForce(tireUp.scale(force), tire.getAbsolutePosition())
	}

    update() {
        let touch = this.deviceSourceManager.getDeviceSource(DeviceType.Touch)
        let mouse = this.deviceSourceManager.getDeviceSource(DeviceType.Mouse)

        if(mouse?.getInput(PointerInput.LeftClick) || touch?.getInput(PointerInput.LeftClick)) {
            let force = this.car.position.scale(10000)
            this.carBody.applyForce(new Vector3(-force.x, 10000, -force.z), this.car.position)
        }

        this.tires.forEach((tire) => {
            let ray = this.tireRay(tire)

            if(ray.hasHit) {
                this.applySuspensionForce(tire, ray)
            }
        })
    }
}
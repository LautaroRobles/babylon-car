import { Color3, DeviceSourceManager, DeviceType, Engine, KeyboardEventTypes, Mesh, MeshBuilder, PhysicsAggregate, PhysicsBody, PhysicsRaycastResult, PhysicsShapeType, PointerInput, Scene, StandardMaterial, TransformNode, Vector3, float } from "@babylonjs/core";
import { IPhysicsEngine } from "@babylonjs/core/Physics/IPhysicsEngine";

function clamp01(value: float): float {
    return Math.min(Math.max(value, 0), 1)
}

function clamp(min: float, max: float, value: float): float {
    return Math.min(Math.max(value, min), max)
}

export default class Car {
    engine: Engine
    scene: Scene
    physicsEngine: IPhysicsEngine
    deviceSourceManager: DeviceSourceManager

    car: Mesh
    carBody: PhysicsBody
    tires: Mesh[]
    tiresMaterials: StandardMaterial[]

    // Input
    left = false
    right = false
    forward = false
    backward = false

    // Car
    size = 4
    width = 2
    height = 1
    mass = 1000

    // Tires
    tireRadius = 1
    TIRE_FL = 2 // Front Left Index
    TIRE_FR = 0 // Front Right Index
    TIRE_RL = 3 // Rear Left Index
    TIRE_RR = 1 // Rear Right Index

    // Suspension
    suspensionRestDistance = 0.5 // TODO: Combine with tireRadius
    suspensionStrength = 20000
    suspensionDamp = 1000

    // Steering
    gripFactorSpeed = 7 // Use different values of grip factor depending on drifting speed
    gripFactorSlow = 0.7
    gripFactorFast = 0.1
    gripStrength = 1000
    currentRotation = 0 // degrees
    maxRotation = 25    // degrees

    // Acceleration
    topSpeed = 120 / 3.6 // convierto km/h a m/s
    tireTorque = 5000
    brakingStrength = 200

    constructor(scene: Scene, engine: Engine, position: Vector3) {
        this.engine = engine
        this.scene = scene
        this.deviceSourceManager = new DeviceSourceManager(engine)
        this.physicsEngine = scene.getPhysicsEngine()!!

        // Modelo y fisicas del auto
        this.car = MeshBuilder.CreateBox("car", { width: this.width, height: this.height, size: this.size })
        this.car.position = position
        this.carBody = new PhysicsAggregate(this.car, PhysicsShapeType.BOX, { mass: this.mass, restitution: 0}, scene).body;

        // Crear ruedas
        this.tires = []
        this.tiresMaterials = []
        for (let i = 0; i < 4; i++) {

            // ???
            let zSign = i % 2 == 0 ? 1 : -1
            let xSign = i < 2 ? 1 : -1

            this.tiresMaterials[i] = new StandardMaterial("tireMaterial")
            this.tiresMaterials[i].diffuseColor = new Color3(0.5, 1, 1)

            this.tires[i] = MeshBuilder.CreateBox("tire", { width: 0.15, height: this.tireRadius * 2, size: this.tireRadius * 2 })
            this.tires[i].position = this.car.position.add(new Vector3(this.width / 2 * xSign, this.height / 2 - 1, this.size / 2 * zSign))
            this.tires[i].material = this.tiresMaterials[i]

            this.car.addChild(this.tires[i])
        }

        // Registrar inputs
        scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    switch (kbInfo.event.key) {
                        case "a":
                            this.left = true                                                               
                            break;
                        case "d":
                            this.right = true                                                               
                            break;
                        case "w":
                            this.forward = true                                                               
                            break;
                        case "s":
                            this.backward = true                                                               
                            break;
                    }
                    break;
                case KeyboardEventTypes.KEYUP:
                    switch (kbInfo.event.key) {
                        case "a":
                            this.left = false     
                            break;
                        case "d":
                            this.right = false                                                               
                            break;
                        case "w":
                            this.forward = false                                                               
                            break;
                        case "s":
                            this.backward = false                                                               
                            break;
                    }
                    break;
            }
        });
    }

    /**
     * Obtiene la posicion global de un child de car
     * @param child
     * @returns 
     */
    globalPosition(child: TransformNode): Vector3 {
        return this.car.position.add(child.position)
    }

    carTransform(vector: Vector3): Vector3 {
        return Vector3.TransformNormal(vector, this.car.getWorldMatrix());
    }

    tireTransform(tire: TransformNode, vector: Vector3): Vector3 {
        return Vector3.TransformNormal(vector, tire.getWorldMatrix())
    }

    // Raycast from the tire CENTER of the tire to the GROUND
    //                 **************
    //             **********************
    //          ****************************
    //       ***********            ***********
    //      ********                    ********
    //    ********                        ********
    //   *******                            *******
    //  *******                              *******
    //  ******                                ******
    // ******                                  ******
    // ******                                  ******
    // ******                |                 ******    -START-
    // ******                |                 ******       | 
    // ******                | tire            ******       | R
    //  ******               | radius         ******        | A
    //  *******              |               *******        | Y
    //   *******             |              *******         |  
    //    ********           |            ********          | C
    //      ********         |          ********            | A
    //       ***********     |      ***********             | S
    //          *************|**************                | T
    //             **********|***********                   |
    //                 ******|*******                     -END-
    // GROUND ----------------------------------------------------------
    // 
    tireRay(tire: Mesh) {
        let start = tire.getAbsolutePosition()
        let end = tire.getAbsolutePosition().add(this.carTransform(Vector3.Down().scale(this.tireRadius)))
        return this.physicsEngine.raycast(start, end)
    }

    applySuspensionForce(tire: Mesh, tireRay: PhysicsRaycastResult)
	{
		// Up direction relative to the tire
		let tireUp = this.tireTransform(tire, Vector3.Up())

		// Get the velocity for the tire
		let tireVelocity = this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(tire.position))

		// Get the velocity proyected on to the tire direction
		let velocity = tireUp.dot(tireVelocity)

		// Calculate offset of the tire relative to the rest position of the suspension
		let offset = tireRay.hitDistance - this.suspensionRestDistance

		// Calculate the force to be applied
		let force = - (offset * this.suspensionStrength) - (velocity * this.suspensionDamp)

        // Apply suspension force at tire position
        this.carBody.applyForce(tireUp.scale(force), tire.getAbsolutePosition())
	}

    applySteeringForce(tire: Mesh)
	{
        // Right direction relative to the tire
		let tireRight = this.tireTransform(tire, Vector3.Right());

		// Get the velocity for the tire
		let tireVelocity = this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(tire.position))

		// Get the velocity proyected on to the tire "right" direction
		let steeringVelocity = tireRight.dot(tireVelocity);

        let normalizedSteeringVelocity = clamp01(steeringVelocity / this.gripFactorSpeed)

        // Low grip if going fast (drifting)
        // High grip if going slow
        let gripFactor = clamp(this.gripFactorFast, this.gripFactorSlow, 1 - normalizedSteeringVelocity)

        // Get the velocity opposite to the current tire velocity
        // If the grip factor is less than 1 the car will drift
        // If its exaclty 1 the car shouldn't drift 
		let desiredVelocityChange = -steeringVelocity * gripFactor;

        // TODO: The desired acceleration should be multiplied by a fixed delta time
		let desiredAcceleration = desiredVelocityChange;

        // Apply steering force at tire position
		this.carBody.applyForce(tireRight.scale(desiredAcceleration).scale(this.gripStrength), tire.getAbsolutePosition());
	}

    applyAccelerationForce(tire: Mesh, index: Number)
	{
        // Forward direction relative to the tire
		let tireForward = this.tireTransform(tire, Vector3.Forward());

        // Solo las ruedas traseras tienen traccion
        if(this.forward && (index == this.TIRE_RL || index == this.TIRE_RR)) {
            // Get current car speed
            let carSpeed = Vector3.Dot(this.carTransform(Vector3.Forward()), this.carBody.getLinearVelocity())

            // Get normalized (0, 1) car speed based on its top speed
            let carNormalizedSpeed = clamp01(Math.abs(carSpeed) / this.topSpeed)
            
            // If im slow I accelerate faster
            // If im fast I accelerate slower
            let availableTorque = clamp01(1.25 - carNormalizedSpeed) * this.tireTorque

            this.carBody.applyForce(tireForward.scale(availableTorque), tire.getAbsolutePosition());
        }
        else if(!this.forward) {
            // Get the velocity for the tire
            let tireVelocity = this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(tire.position))

            // Get the velocity proyected on to the tire "forward" direction
            let forwardVelocity = tireForward.dot(tireVelocity);

            // Get the velocity opposite to the current tire velocity
            let desiredVelocityChange = -forwardVelocity;

            // TODO: The desired acceleration should be multiplied by a fixed delta time
            let desiredAcceleration = desiredVelocityChange;

            // Apply steering force at tire position
            this.carBody.applyForce(tireForward.scale(desiredAcceleration * this.brakingStrength), tire.getAbsolutePosition());
        }
	}

    update() {

        // DEBUG
        let mouse = this.deviceSourceManager.getDeviceSource(DeviceType.Mouse)
        if(mouse?.getInput(PointerInput.LeftClick)) {
            this.carBody.applyForce(this.carTransform(Vector3.Right()).scale(5000), this.car.position)
        }
        if(mouse?.getInput(PointerInput.RightClick)) {
            this.carBody.applyForce(this.carTransform(Vector3.Right()).scale(-5000), this.car.position)
        }

        // Rotar las ruedas
        if(this.left)
            this.currentRotation -= 1
        else if(this.right)
            this.currentRotation += 1

        if(!this.left && !this.right && this.currentRotation != 0)
            this.currentRotation -= Math.abs(this.currentRotation) / this.currentRotation

        this.currentRotation = clamp(-this.maxRotation, this.maxRotation, this.currentRotation)

        console.log(this.currentRotation)

        this.tires[this.TIRE_FL].rotation = new Vector3(0, this.currentRotation * Math.PI / 180, 0)
        this.tires[this.TIRE_FR].rotation = new Vector3(0, this.currentRotation * Math.PI / 180, 0)

        // Aplicar fuerzas
        this.tires.forEach((tire, index) => {
            let ray = this.tireRay(tire)

            if(ray.hasHit) {
                this.applySuspensionForce(tire, ray)
                this.applySteeringForce(tire)
                this.applyAccelerationForce(tire, index)

                this.tiresMaterials[index].diffuseColor = new Color3(0.5, 1, 1)
            }
            else {
                this.tiresMaterials[index].diffuseColor = new Color3(1, 0.5, 0.5)
            }
        })
    }
}
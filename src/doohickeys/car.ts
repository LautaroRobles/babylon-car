import { Color3, Color4, DeviceSourceManager, DeviceType, Engine, KeyboardEventTypes, LinesMesh, Mesh, MeshBuilder, PhysicsAggregate, PhysicsBody, PhysicsRaycastResult, PhysicsShape, PhysicsShapeType, PointerInput, Ray, RayHelper, Scene, StandardMaterial, TransformNode, Vector3, float } from "@babylonjs/core";
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
    carShape: PhysicsShape
    carBody: PhysicsBody
    tires: Mesh[]
    tiresMaterials: StandardMaterial[]

    // Input
    left = false
    right = false
    forward = false
    backward = false

    // Car
    size = 5
    width = 3
    height = 1
    mass = 1000

    // Tires
    tireRadius = 2
    TIRE_FL = 2 // Front Left Index
    TIRE_FR = 0 // Front Right Index
    TIRE_RL = 3 // Rear Left Index
    TIRE_RR = 1 // Rear Right Index

    // Suspension
    suspensionRestDistance = 0 // TODO: Combine with tireRadius
    suspensionStrength = 20000
    suspensionDamp = 1000

    // Steering
    gripFactorSpeed = 5  // Lower values makes drifting easier?
    gripFactorFast = 0.2 // When going fast
    gripFactorSlow = 1   // When going slow
    frontGripStrength = 3000
    rearGripStrength = 1500
    currentRotation = 0 // degrees
    maxRotation = 15    // degrees

    // Acceleration
    topSpeed = 120 / 3.6 // convierto km/h a m/s
    engineTorque = 5000
    brakingStrength = 500

    // DEBUG
    lines: LinesMesh[]

    constructor(scene: Scene, engine: Engine, position: Vector3) {
        this.engine = engine
        this.scene = scene
        this.deviceSourceManager = new DeviceSourceManager(engine)
        this.physicsEngine = scene.getPhysicsEngine()!!

        // Modelo y fisicas del auto
        this.car = MeshBuilder.CreateBox("car", { width: this.width, height: this.height, size: this.size })
        this.car.position = position
        let physicsAggregate = new PhysicsAggregate(this.car, PhysicsShapeType.BOX, { mass: this.mass, restitution: 0}, scene);
        this.carBody = physicsAggregate.body
        this.carShape = physicsAggregate.shape
        this.carShape.filterMembershipMask = 1

        // Crear ruedas
        this.tires = []
        this.tiresMaterials = []
        this.lines = []
        for (let i = 0; i < 4; i++) {

            // ???
            let zSign = i % 2 == 0 ? 1 : -1
            let xSign = i < 2 ? 1 : -1

            this.tiresMaterials[i] = new StandardMaterial("tireMaterial")
            this.tiresMaterials[i].diffuseColor = new Color3(0.5, 1, 1)
            this.tiresMaterials[i].alpha = 0.5

            this.tires[i] = MeshBuilder.CreateBox("tire", { width: 0.15, height: this.tireRadius, size: this.tireRadius })
            this.tires[i].position = this.car.position.add(new Vector3(this.width / 2 * xSign, this.height - this.tireRadius, this.size / 2 * zSign))
            this.tires[i].material = this.tiresMaterials[i]
            
            // DEBUG
            this.lines[i] = MeshBuilder.CreateLines("debug", { 
                points: [Vector3.Zero(), Vector3.Zero()], 
                colors: [new Color4(0.1, 1, 0.1, 1), new Color4(0.1, 1, 0.1, 1)],
                updatable: true,
                useVertexAlpha: false
            })

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
    tireRay(tire: Mesh, index: number): PhysicsRaycastResult {
        let start = tire.getAbsolutePosition().add(this.carTransform(Vector3.Up().scale(this.tireRadius / 2)))
        let end = tire.getAbsolutePosition().add(this.carTransform(Vector3.Down().scale(this.tireRadius / 2)))
        let ray = this.physicsEngine.raycast(start, end, { collideWith: 2 }) // TODO: Revisar porque el piso es 2

        let color = new Color4(1, 0.5, 0.5, 1)

        if(ray.hasHit)
            color = new Color4(0.5, 1, 0.5, 1)

        this.lines[index] = MeshBuilder.CreateLines("debug", { 
            points: [start, end], 
            colors: [color, color],
            updatable: true,
            instance: this.lines[index],
            useVertexAlpha: false
        })

        return ray
    }

    applySuspensionForce(tire: Mesh, tireRay: PhysicsRaycastResult)
	{
		// Up direction relative to the tire
		let tireUp = this.tireTransform(tire, Vector3.Up())

		// Get the velocity for the tire
		let tireVelocity = this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(this.carTransform(tire.position)))

		// Get the velocity proyected on to the tire direction
		let velocity = tireUp.dot(tireVelocity)

		// Calculate offset of the tire relative to the rest position of the suspension
		let offset = tireRay.hitDistance - (this.suspensionRestDistance + this.tireRadius * 0.5)

		// Calculate the force to be applied
		let force = - (offset * this.suspensionStrength) - (velocity * this.suspensionDamp)

        // Apply suspension force at tire position
        this.carBody.applyForce(tireUp.scale(force), tire.getAbsolutePosition())
	}

    applySteeringForce(tire: Mesh, index: number)
	{
        // Right direction relative to the tire
		let tireRight = this.tireTransform(tire, Vector3.Right());

		// Get the velocity for the tire
		let tireVelocity = this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(this.carTransform(tire.position)))

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

        // TODO: Mejorar esto
        let gripStrength = (index == this.TIRE_FL || index == this.TIRE_FR) ? this.frontGripStrength : this.rearGripStrength

        // Apply steering force at tire position
		this.carBody.applyForce(tireRight.scale(desiredAcceleration).scale(gripStrength), tire.getAbsolutePosition());
	}

    applyAccelerationForce(tire: Mesh, index: number)
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
            // TODO: Change this to a lookuptable
            let availableTorque = clamp01(1.25 - carNormalizedSpeed) * this.engineTorque

            this.carBody.applyForce(tireForward.scale(availableTorque), tire.getAbsolutePosition());
        }
        else if(!this.forward) {
            // Get the velocity for the tire
            let tireVelocity = this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(this.carTransform(tire.position)))

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
            this.carBody.applyForce(this.carTransform(Vector3.Right()).scale(50000), this.car.position)
        }
        if(mouse?.getInput(PointerInput.RightClick)) {
            this.carBody.applyForce(this.carTransform(Vector3.Right()).scale(-50000), this.car.position)
        }
        if(mouse?.getInput(PointerInput.MiddleClick)) {
            this.carBody.applyForce(this.carTransform(Vector3.Up()).scale(50000), this.car.position)
        }

        // Rotar las ruedas
        // TODO: Hacer mejor
        if(this.left)
            this.currentRotation -= 2
        else if(this.right)
            this.currentRotation += 2

        if(!this.left && !this.right && this.currentRotation != 0)
            this.currentRotation -= Math.abs(this.currentRotation) / this.currentRotation

        this.currentRotation = clamp(-this.maxRotation, this.maxRotation, this.currentRotation)

        this.tires[this.TIRE_FL].rotation = new Vector3(0, this.currentRotation * Math.PI / 180, 0)
        this.tires[this.TIRE_FR].rotation = new Vector3(0, this.currentRotation * Math.PI / 180, 0)

        // Aplicar fuerzas
        this.tires.forEach((tire, index) => {
            let ray = this.tireRay(tire, index)

            if(ray.hasHit) {
                this.applySuspensionForce(tire, ray)
                this.applySteeringForce(tire, index)
                this.applyAccelerationForce(tire, index)

                this.tiresMaterials[index].diffuseColor = new Color3(0.5, 1, 0.5)
            }
            else {
                this.tiresMaterials[index].diffuseColor = new Color3(1, 0.5, 0.5)
            }
        })
    }
}
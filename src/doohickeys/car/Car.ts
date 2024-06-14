import { Color3, Color4, DeviceSourceManager, DeviceType, Engine, KeyboardEventTypes, LinesMesh, Material, Mesh, MeshBuilder, Nullable, PhysicsAggregate, PhysicsBody, PhysicsEngine, PhysicsMotionType, PhysicsRaycastResult, PhysicsShape, PhysicsShapeBox, PhysicsShapeType, PointerInput, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import { IPhysicsEngine } from "@babylonjs/core/Physics/IPhysicsEngine";
import { EMath } from "../../utils/EMath";
import Tire from "./Tire";

export default class Car extends TransformNode {
    engine: Engine
    scene: Scene
    physicsEngine: IPhysicsEngine

    carMesh: Mesh
    carShape: PhysicsShape
    carBody: PhysicsBody

    dimensions
    mass
    inertia
    tires
    acceleration
    steering
    suspension

    inputs: {
        accelerationInput: number,
        rotationAngleChange: number,
    }

    currentRotationAngle = 0 // degrees

    constructor(name: string, scene: Scene, engine: Engine, physicsEngine: IPhysicsEngine, options: {
        dimensions: {
            size: number
            height: number
            width: number
        }
        mass: number,
        inertia?: Vector3,
        tires: Tire[],
        acceleration: {
            topSpeedKmh: number,
            engineStrenght: number,
            brakingStrength: number,
            deaccelerationStrength: number,
        },
        steering: {
            maxRotationAngle: number
        },
        suspension: {
            rayLength: number,
            restDistance: number,
            springStrength: number,
            springDamp: number,
        },
    }) {
        super(name, scene);

        this.scene = scene
        this.engine = engine
        this.physicsEngine = physicsEngine

        this.dimensions = options.dimensions
        this.mass = options.mass
        this.inertia = options.inertia
        this.tires = options.tires
        this.acceleration = options.acceleration
        this.steering = options.steering
        this.suspension = options.suspension

        this.carMesh = MeshBuilder.CreateCapsule("carMesh", { height: this.dimensions.size, radius: this.dimensions.width / 2, orientation: Vector3.Forward() })
        
        this.carShape = new PhysicsShape({
            parameters: {
                mesh: this.carMesh,
            },
            type: PhysicsShapeType.MESH
        }, scene);
        this.carShape.filterMembershipMask = 1

        this.carBody = new PhysicsBody(this, PhysicsMotionType.DYNAMIC, false, scene);
        this.carBody.setMassProperties({ mass: this.mass, inertia: this.inertia })
        this.carBody.shape = this.carShape

        this.addChild(this.carMesh)
        this.tires.forEach((tire) => {
            this.addChild(tire)
        })

        this.inputs = {
            accelerationInput: 0,
            rotationAngleChange: 0
        }
    }

    getVelocityAtPoint(point: Vector3) {
        return this.carBody.getLinearVelocity().add(this.carBody.getAngularVelocity().cross(point.subtract(this.getAbsolutePosition())))
    }

    tireRay(tire: Tire): PhysicsRaycastResult {
        let rayVector = tire.up.scale(-this.suspension.rayLength)

        let start = tire.getAbsolutePosition()
        let end = tire.getAbsolutePosition().add(rayVector)
        return this.physicsEngine.raycast(start, end, { collideWith: 2 }) // TODO: Revisar porque el piso es 2
    }

    applySuspensionForce(tire: Tire, tireRay: PhysicsRaycastResult)
	{
		// Up direction relative to the tire
		let tireUp = tire.up

		// Get the velocity for the tire
		let tireVelocity = this.getVelocityAtPoint(tire.getAbsolutePosition())

		// Get the velocity proyected on to the tire direction
		let velocity = tireUp.dot(tireVelocity)

		// Calculate offset of the tire relative to the rest position of the suspension
		let offset = tireRay.hitDistance - this.suspension.restDistance

		// Calculate the force to be applied
		let force = - (offset * this.suspension.springStrength) - (velocity * this.suspension.springDamp)

        // Apply suspension force at tire position
        this.carBody.applyForce(tireUp.scale(force), tire.getAbsolutePosition())
	}

    applySteeringForce(tire: Tire)
	{
        // Right direction relative to the tire
		let tireRight = tire.right

		// Get the velocity for the tire
		let tireVelocity = this.getVelocityAtPoint(tire.getAbsolutePosition())

		// Get the velocity proyected on to the tire "right" direction
		let steeringVelocity = tireRight.dot(tireVelocity);

        let normalizedSteeringVelocity = EMath.clamp01(Math.abs(steeringVelocity) / (tire.gripSpeedKmh / 3.6))

        // Low grip if going fast (drifting)
        // High grip if going slow
        let gripFactor = EMath.lerp(tire.slowGrip, tire.fastGrip, normalizedSteeringVelocity)

        // Get the velocity opposite to the current tire velocity
		let desiredVelocityChange = -steeringVelocity * gripFactor;

		let desiredAcceleration = desiredVelocityChange / this.physicsEngine.getTimeStep();

        // Apply steering force at tire position
		this.carBody.applyForce(tireRight.scale(desiredAcceleration), tire.getAbsolutePosition());
	}

    applyAccelerationForce(tire: Tire)
	{
        // Forward direction relative to the tire
        let tireForward = tire.forward;

        // Thrust
        if(this.inputs.accelerationInput > 0 && tire.canThrust) {
            // Get current car speed
            let carSpeed = Vector3.Dot(this.forward, this.carBody.getLinearVelocity())

            // Get top speed in m/s
            let topSpeed = this.acceleration.topSpeedKmh / 3.6

            // Get normalized (0, 1) car speed based on its top speed
            let carNormalizedSpeed = EMath.clamp01(Math.abs(carSpeed) / topSpeed)
            
            // If im slow I accelerate faster
            // If im fast I accelerate slower
            // TODO: Change this to a lookuptable
            let availableEngineStrength = EMath.clamp01((Math.sqrt(carNormalizedSpeed) + 0.5) * -(carNormalizedSpeed * carNormalizedSpeed - 1)) * this.acceleration.engineStrenght

            this.carBody.applyForce(tireForward.scale(availableEngineStrength), tire.getAbsolutePosition());
        }
        // Break
        else if(this.inputs.accelerationInput < 0) {
            // Get the velocity for the tire
            let tireVelocity = this.getVelocityAtPoint(tire.getAbsolutePosition())

            // Get the velocity proyected on to the tire "forward" direction
            let forwardVelocity = tireForward.dot(tireVelocity);

            // Get the velocity opposite to the current tire velocity
            let desiredVelocityChange = -forwardVelocity * this.acceleration.brakingStrength;

            let desiredAcceleration = desiredVelocityChange / this.physicsEngine.getTimeStep();

            // Apply steering force at tire position
            this.carBody.applyForce(tireForward.scale(desiredAcceleration), tire.getAbsolutePosition());

        }
        // Engine deacceleration
        else if(this.inputs.accelerationInput == 0) {
            // Get the velocity for the tire
            let tireVelocity = this.getVelocityAtPoint(tire.getAbsolutePosition())

            // Get the velocity proyected on to the tire "forward" direction
            let forwardVelocity = tireForward.dot(tireVelocity);

            // Get the velocity opposite to the current tire velocity
            let desiredVelocityChange = -forwardVelocity * this.acceleration.deaccelerationStrength;

            let desiredAcceleration = desiredVelocityChange / this.physicsEngine.getTimeStep();

            // Apply steering force at tire position
            this.carBody.applyForce(tireForward.scale(desiredAcceleration), tire.getAbsolutePosition());
        }
	}

    applyDeaccelerationForce(tire: Tire) {
        if(this.inputs.accelerationInput == 0) {
            // Forward direction relative to the tire
            let tireForward = tire.forward;

            // Get the velocity for the tire
            let tireVelocity = this.getVelocityAtPoint(tire.getAbsolutePosition())

            // Get the velocity proyected on to the tire "forward" direction
            let forwardVelocity = tireForward.dot(tireVelocity);

            // Get the velocity opposite to the current tire velocity
            let desiredVelocityChange = -forwardVelocity * this.acceleration.deaccelerationStrength;

            let desiredAcceleration = desiredVelocityChange / this.physicsEngine.getTimeStep();

            // Apply steering force at tire position
            this.carBody.applyForce(tireForward.scale(desiredAcceleration), tire.getAbsolutePosition());
        }
    }

    applyTireRotation(tire: Tire) {
        if(!tire.canRotate)
            return

        // Slowly go back to neutral rotation
        if(this.inputs.rotationAngleChange == 0 && this.currentRotationAngle != 0) {
            this.currentRotationAngle -= (Math.abs(this.currentRotationAngle) / this.currentRotationAngle) * 2
        }

        // Apply input rotation
        this.currentRotationAngle += this.inputs.rotationAngleChange

        // Clamp the rotation angle
        this.currentRotationAngle = EMath.clamp(-this.steering.maxRotationAngle, this.steering.maxRotationAngle, this.currentRotationAngle)

        // Apply rotation to tire
        tire.rotation = new Vector3(0, tire.canRotate * this.currentRotationAngle * Math.PI / 180, 0)
    }

    update() {
        this.tires.forEach((tire) => {
            let ray = this.tireRay(tire)

            if(ray.hasHit) {
                this.applySuspensionForce(tire, ray)
                this.applySteeringForce(tire)
                this.applyAccelerationForce(tire)
            }

            // TODO: Mover esta logica de posicionar el mesh del Tire a Tire.ts
            let hitDistance = ray.hitDistance == 0 ? this.suspension.rayLength : ray.hitDistance
            tire.mesh.position.y = tire.position.y - hitDistance + 1

            this.applyTireRotation(tire)
        })
    }
}
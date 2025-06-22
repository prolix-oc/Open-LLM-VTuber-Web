### How to Directly Manipulate Parameters

You can access the core model via `model.internalModel.coreModel`.

### 1. For Cubism 4 Models

The API for Cubism 4 is more straightforward, as it uses string-based IDs directly.

**Path to Core Model:** `live2dModel.internalModel.coreModel` (instance of `CubismModel`)

**Key Methods:**

*   `setParameterValueById(id: string, value: number, weight: number = 1.0)`: Sets a parameter's value.
*   `addParameterValueById(id: string, value: number, weight: number = 1.0)`: Adds a value to a parameter.
*   `multiplyParameterValueById(id: string, value: number, weight: number = 1.0)`: Multiplies a parameter by a value.
*   `getParameterValueById(id: string): number`: Gets the current value of a parameter.
*   `getParameterIds(): string[]`: Gets a list of all parameter IDs for the model.

**Example:**

```javascript
import { Live2DModel } from 'pixi-live2d-display';

const model = await Live2DModel.from('path/to/haru.model3.json');

// Ensure the model is a Cubism 4 model before using the C4 API
if (model.internalModel.constructor.name.includes('Cubism4')) {
    const coreModel = model.internalModel.coreModel;

    // --- Make the model wink ---
    // The value for eye opening is typically 0 (closed) to 1 (open).
    coreModel.setParameterValueById('ParamEyeLOpen', 0);
    coreModel.setParameterValueById('ParamEyeROpen', 0);


    // --- Make the model open its mouth ---
    // The value for mouth opening is typically 0 (closed) to 1 (fully open).
    coreModel.setParameterValueById('ParamMouthOpenY', 0.8);


    // --- Add to a parameter's value ---
    // This is useful for things like head rotation (ParamAngleX, ParamAngleY)
    // where you want to add to the existing value calculated by motions.
    coreModel.addParameterValueById('ParamAngleZ', 15); // Turn head
}
```

#### Finding Parameter IDs for Cubism 4

1.  **Programmatically:** Call `model.internalModel.coreModel.getParameterIds()` to get an array of all available IDs.
2.  **Inspect the `.model3.json` file:** Look under the `Groups` section. Common parameters like `EyeBlink` and `LipSync` will list the IDs they control.
3.  **Live2D Cubism Editor:** Open the model in the editor to see all parameter names and their ranges.

---

### 2. For Cubism 2 Models

The API for Cubism 2 is a two-step process: first, you get a numeric index for the parameter's string ID, and then you use that index to manipulate the value.

**Path to Core Model:** `live2dModel.internalModel.coreModel` (instance of `Live2DModelWebGL`)

**Key Methods:**

*   `getParamIndex(id: string): number`: Gets the numeric index for a parameter ID.
*   `setParamFloat(index: number, value: number, weight: number = 1.0)`: Sets a parameter's value using its index.
*   `addToParamFloat(index: number, value: number, weight: number = 1.0)`: Adds a value to a parameter.
*   `multParamFloat(index: number, value: number, weight: number = 1.0)`: Multiplies a parameter by a value.
*   `getParamFloat(index: number): number`: Gets the current value of a parameter.

**Example:**

```javascript
import { Live2DModel } from 'pixi-live2d-display';

const model = await Live2DModel.from('path/to/shizuku.model.json');

// Ensure the model is a Cubism 2 model before using the C2 API
if (model.internalModel.constructor.name.includes('Cubism2')) {
    const coreModel = model.internalModel.coreModel;

    // --- Make the model wink ---
    const eyeLOpenIndex = coreModel.getParamIndex('PARAM_EYE_L_OPEN');
    const eyeROpenIndex = coreModel.getParamIndex('PARAM_EYE_R_OPEN');

    coreModel.setParamFloat(eyeLOpenIndex, 0);
    coreModel.setParamFloat(eyeROpenIndex, 0);

    // --- Make the model open its mouth ---
    const mouthOpenIndex = coreModel.getParamIndex('PARAM_MOUTH_OPEN_Y');
    coreModel.setParamFloat(mouthOpenIndex, 0.8);

    // --- Add to a parameter's value ---
    const angleZIndex = coreModel.getParamIndex('PARAM_ANGLE_Z');
    coreModel.addToParamFloat(angleZIndex, 15); // Turn head
}
```

#### Finding Parameter IDs for Cubism 2

The process is similar to Cubism 4, but you'll be looking at the `.model.json` file. The parameter IDs are not explicitly listed in a neat array, but you can find them referenced in the `motions` or `expressions` definitions within the JSON structure. Using the Live2D Cubism 2.1 Editor is the most reliable way.

---

### Important Considerations

**1. Conflicts with MotionManager and ExpressionManager**

The `MotionManager` and `ExpressionManager` also manipulate these same parameters on every frame update. If you set a parameter value manually, it will likely be **overwritten** on the very next frame by any active motion or expression.

**2. Making Changes Persistent**

To make your manual changes stick, you must re-apply them on every frame within your application's update loop, *after* `model.update()` has been called.

```javascript
// In your application's update loop
app.ticker.add(() => {
    // The library's internal updates run first
    model.update(app.ticker.deltaMS);

    // Now, apply your custom overrides
    const coreModel = model.internalModel.coreModel;

    if (isWinking) {
        // For a C4 model
        coreModel.setParameterValueById('ParamEyeLOpen', 0);
    }

    // This ensures your value is the final one before rendering
});
```

**3. When to Use Direct Manipulation**

Direct parameter control is best for:
*   Creating custom logic that isn't based on pre-defined motions (e.g., tracking a user's face).
*   Applying subtle, additive effects on top of existing motions (using `addParameterValueById` or `addToParamFloat`).
*   Situations where you have disabled the built-in `MotionManager` to implement your own animation system.
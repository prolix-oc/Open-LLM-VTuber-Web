# pixi-live2d-display Documentation

This document provides a comprehensive guide to using `pixi-live2d-display-lipsyncpatch`, a library for integrating Live2D models into PixiJS applications.

## Table of Contents
1.  [Introduction](#1-introduction)
2.  [Setup & Installation](#2-setup--installation)
3.  [Creating a Model](#3-creating-a-model)
    -   [Asynchronous Loading](#asynchronous-loading-live2dmodelfrom)
    -   [Synchronous Loading](#synchronous-loading-live2dmodelfromsync)
    -   [Creation Options](#creation-options)
4.  [Display & Transformation](#4-display--transformation)
5.  [Updating the Model](#5-updating-the-model)
    -   [Automatic Updates](#automatic-updates)
    -   [Manual Updates](#manual-updates)
6.  [Interaction](#6-interaction)
    -   [Automatic Interaction](#automatic-interaction)
    -   [Manual Interaction](#manual-interaction)
    -   [Hit Testing](#hit-testing)
7.  [Motions](#7-motions)
    -   [Starting a Motion](#starting-a-motion)
    -   [Idle Motions](#idle-motions)
    -   [Motion Priority](#motion-priority)
    -   [Stopping Motions](#stopping-motions)
    -   [Preloading Motions](#preloading-motions)
8.  [Expressions](#8-expressions)
9.  [Lip Sync & Sound](#9-lip-sync--sound)
    -   [Speaking (Lip Sync)](#speaking-lip-sync)
    -   [Motion Sounds](#motion-sounds)
    -   [SoundManager](#soundmanager)
10. [Global Configuration](#10-global-configuration)
11. [Advanced Features & Tools](#11-advanced-features--tools)
    -   [HitAreaFrames](#hitareaframes)
    -   [Loading from Files](#loading-from-files)
    -   [Loading from a Zip Archive](#loading-from-a-zip-archive)
12. [Core API Reference](#12-core-api-reference)

---

## 1. Introduction

`pixi-live2d-display` is a plugin for PixiJS that simplifies the process of rendering and interacting with Live2D Cubism 2 and Cubism 4 models. It provides a high-level API that abstracts away the complexities of the Live2D Core SDKs.

## 2. Setup & Installation

First, ensure you have `pixi.js` installed. Then, install the library:

```bash
npm install pixi-live2d-display-lipsyncpatch
```

You also need to include the Live2D Core scripts in your project. You can run `npm run setup` to download them into a `core/` directory or include them via a `<script>` tag in your HTML.

```html
<!-- For Cubism 2 Models -->
<script src="/path/to/core/live2d.min.js"></script>

<!-- For Cubism 4 Models -->
<script src="/path/to/core/live2dcubismcore.js"></script>
```

## 3. Creating a Model

The `Live2DModel` class is the main entry point. It can be created from a model settings file.

### Asynchronous Loading (`Live2DModel.from`)

This is the recommended way to create a model. It returns a `Promise` that resolves when the model and its essential resources are fully loaded.

```javascript
import { Live2DModel } from 'pixi-live2d-display';

// Make PIXI available to the library
window.PIXI = PIXI;

const app = new PIXI.Application();
document.body.appendChild(app.view);

const model = await Live2DModel.from('path/to/your/model.model3.json');

app.stage.addChild(model);
```

The `source` for `Live2DModel.from` can be:
-   A **URL** to the model settings file (`.model.json` or `.model3.json`).
-   A **JSON object** representing the model settings. You must include a `url` property in this object so the library knows where to load other resources from.
-   An instance of `Cubism2ModelSettings` or `Cubism4ModelSettings`.

### Synchronous Loading (`Live2DModel.fromSync`)

This method returns a `Live2DModel` instance immediately, with resource loading happening in the background. You **must** wait for the `load` event before adding the model to the stage or interacting with it.

```javascript
const model = Live2DModel.fromSync('path/to/your/model.model3.json');

model.on('load', () => {
    // Now it's safe to use the model
    app.stage.addChild(model);
    model.motion('Idle');
});
```

### Creation Options

The `from` and `fromSync` methods accept an `options` object:

```javascript
const options = {
    // Motion options
    motionPreload: 'IDLE', // or 'ALL', 'NONE'
    idleMotionGroup: 'Idle',

    // Interaction options
    autoUpdate: true,
    autoFocus: true,
    autoHitTest: true,

    // Sound options
    sound: true,
    motionSync: true,

    // Callbacks
    onLoad: () => console.log('Model loaded!'),
    onError: (err) => console.error(err),
};

const model = await Live2DModel.from(source, options);
```

## 4. Display & Transformation

The `Live2DModel` instance is a PixiJS `Container` and can be manipulated as such.

-   `model.position.set(x, y)`: Moves the model.
-   `model.scale.set(x, y)`: Scales the model.
-   `model.rotation = Math.PI / 4`: Rotates the model.
-   `model.alpha = 0.5`: Sets the model's opacity.

### Anchor Point

The `anchor` property works like `PIXI.Sprite.anchor`. It sets the origin point for transformations. `(0, 0)` is the top-left corner, and `(0.5, 0.5)` is the center.

```javascript
// Set the anchor to the center of the model
model.anchor.set(0.5, 0.5);
```

## 5. Updating the Model

A Live2D model needs to be updated on every frame to animate.

### Automatic Updates

By default (`autoUpdate: true`), the model will automatically update using `PIXI.Ticker.shared`. For this to work, you must either:
1.  Expose PixiJS to the global scope: `window.PIXI = PIXI;`
2.  Or register the Ticker class: `Live2DModel.registerTicker(PIXI.Ticker);`

### Manual Updates

If `autoUpdate` is `false`, you must manually update the model in your application's update loop.

```javascript
const model = await Live2DModel.from(source, { autoUpdate: false });

app.ticker.add((delta) => {
    // The argument is delta frames, we need delta time in milliseconds.
    model.update(app.ticker.deltaMS);
});
```

## 6. Interaction

The library can automatically handle pointer interactions for focusing and hit-testing.

### Automatic Interaction

With `autoFocus: true` (default), the model will look at the mouse pointer.
With `autoHitTest: true` (default), the model will emit a `hit` event when tapped.

```javascript
model.on('hit', (hitAreaNames) => {
    console.log('Hit on:', hitAreaNames.join(', '));

    if (hitAreaNames.includes('Head')) {
        model.expression('f01');
    }
    if (hitAreaNames.includes('Body')) {
        model.motion('Tap');
    }
});
```

### Manual Interaction

If you disable automatic interaction, you can trigger these behaviors manually.

```javascript
const model = await Live2DModel.from(source, { autoFocus: false, autoHitTest: false });

// Manually set focus
app.view.addEventListener('pointermove', (e) => {
    model.focus(e.clientX, e.clientY);
});

// Manually trigger a tap
app.view.addEventListener('pointerdown', (e) => {
    model.tap(e.clientX, e.clientY);
});
```

### Hit Testing

You can perform hit-testing at any time.

-   `model.hitTest(x, y)`: Takes world coordinates and returns an array of hit area names.

## 7. Motions

Motions are animations defined in the model's settings.

### Starting a Motion

Use the `model.motion()` method to start a motion.

```javascript
// Start the first motion in the "Tap" group with normal priority
model.motion('Tap', 0, 2);

// Start a random motion from the "Tap" group
model.motion('Tap');
```

**`model.motion(group, index, priority, options)`**
-   `group` (string): The name of the motion group (e.g., "Idle", "Tap").
-   `index` (number, optional): The index of the motion within the group. If omitted, a random motion is played.
-   `priority` (number, optional): The motion's priority. See below. Defaults to `2` (NORMAL).
-   `options` (object, optional): An object for sound playback.
    -   `sound` (string): URL or base64 data for an audio file to play alongside the motion.
    -   `volume` (number): Volume for the sound (0-1).
    -   `onFinish` (function): Callback when the motion finishes.
    -   `onError` (function): Callback on sound playback error.

### Idle Motions

When no other motion is playing, the model will automatically play a random motion from its idle group. The default idle group is `"idle"` for Cubism 2 and `"Idle"` for Cubism 4. You can override this with the `idleMotionGroup` option.

### Motion Priority

-   `0` (NONE): Internal use.
-   `1` (IDLE): Low priority. Can be interrupted by NORMAL or FORCE.
-   `2` (NORMAL): Medium priority. Can be interrupted by FORCE.
-   `3` (FORCE): High priority. Interrupts any other motion.

### Stopping Motions

-   `model.stopMotions()`: Stops all currently playing motions and cancels any pending ones.

### Preloading Motions

To avoid delays, you can preload motions using the `motionPreload` option during creation:
-   `'NONE'` (default): No preloading.
-   `'IDLE'`: Preloads only motions in the idle group.
-   `'ALL'`: Preloads all defined motions.

## 8. Expressions

Expressions are facial animations that can be applied to the model.

**`model.expression(id)`**
-   `id` (string | number, optional): The name or index of the expression. If omitted, a random expression is applied.

```javascript
// Set expression by name
model.expression('smile');

// Set expression by index
model.expression(2);

// Set a random expression
model.expression();
```

## 9. Lip Sync & Sound

The library includes built-in support for audio playback and lip-syncing.

### Speaking (Lip Sync)

The `model.speak()` method plays an audio file and automatically syncs the model's mouth movements to it.

**`model.speak(sound, options)`**
-   `sound` (string): URL or base64 data for the audio file.
-   `options` (object, optional):
    -   `volume` (number): Playback volume (0-1).
    -   `expression` (string | number): An expression to apply during speech.
    -   `resetExpression` (boolean): If `true`, resets the expression when speech finishes. Default is `true`.
    -   `onFinish` (function): Callback when playback finishes.
    -   `onError` (function): Callback on playback error.

```javascript
// Speak a line with a happy expression
model.speak('sounds/hello.mp3', { expression: 'smile' });
```

-   `model.stopSpeaking()`: Immediately stops the current audio and lip-sync.

### Motion Sounds

As mentioned in the Motions section, you can play a sound synchronized with a motion by passing the `sound` URL in the `motion()` method's options.

### SoundManager

The `SoundManager` is a static class that handles all audio.

-   `SoundManager.volume`: A global volume control (0-1) for all sounds managed by the library.

```javascript
import { SoundManager } from 'pixi-live2d-display';

// Set global volume to 50%
SoundManager.volume = 0.5;
```

## 10. Global Configuration

You can change global settings that affect all models via the `config` object.

```javascript
import { config } from 'pixi-live2d-display';

// Log level: VERBOSE, WARNING, ERROR, NONE
config.logLevel = config.LOG_LEVEL_WARNING;

// Enable/disable sound for all motions
config.sound = true;

// Defer motion playback until its sound is also loaded
config.motionSync = true;

// Default fade durations in milliseconds
config.motionFadingDuration = 500;
config.idleMotionFadingDuration = 2000;
config.expressionFadingDuration = 500;
```

## 11. Advanced Features & Tools

### HitAreaFrames

For debugging, you can display the hit areas as colored frames. This feature is in an "extra" bundle to keep the main bundle small.

```javascript
import { HitAreaFrames } from 'pixi-live2d-display/extra';

const hitAreaFrames = new HitAreaFrames();
model.addChild(hitAreaFrames);
```

### Loading from Files

You can load a model from an array of `File` objects, such as those from a `<input type="file" webkitdirectory>`. Each `File` object must have a `webkitRelativePath`.

```javascript
const fileInput = document.getElementById('my-file-input');

fileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length) {
        const model = await Live2DModel.from(files);
        app.stage.addChild(model);
    }
});
```

### Loading from a Zip Archive

Models can be loaded from a `.zip` file. This requires you to provide an implementation for a zipping library like `jszip`.

```javascript
import { ZipLoader } from 'pixi-live2d-display/cubism4'; // or cubism2
import JSZip from 'jszip';

// Provide implementations for ZipLoader
ZipLoader.zipReader = (data) => JSZip.loadAsync(data);
ZipLoader.getFilePaths = (reader) => Promise.resolve(Object.keys(reader.files));
// ... and other required methods

// Now you can load from a zip URL
const model = await Live2DModel.from('path/to/model.zip');
```

## 12. Core API Reference

For advanced use cases, you may need to interact with the underlying classes.

-   **`Live2DModel`**: The main PIXI `Container`. Your primary interaction point.
    -   `.internalModel`: Access to the lower-level model wrapper.
    -   `.automator`: Manages automatic updates and interactions.
    -   `.textures`: Array of `PIXI.Texture` used by the model.
    -   `.anchor`: `PIXI.ObservablePoint` to set the transform origin.

-   **`InternalModel`**: A wrapper around the Live2D Core model.
    -   `.coreModel`: The actual model instance from the Live2D SDK.
    -   `.motionManager`: Instance of `MotionManager`.
    -   `.settings`: The parsed `ModelSettings` for this model.
    -   `.focusController`: Manages focus point interpolation.
    -   `.hitTest(x, y)`: Hit-testing using model-space coordinates.

-   **`MotionManager`**: Handles all motion and sound playback logic.
    -   `.startMotion()` / `.startRandomMotion()`: Core methods for playing motions.
    -   `.speak()` / `.stopSpeaking()`: Methods for lip-sync.
    -   `.expressionManager`: Instance of `ExpressionManager`.

-   **`ExpressionManager`**: Manages expressions.
    -   `.setExpression()` / `.setRandomExpression()`: Core methods for applying expressions.

-   **`ModelSettings`**: A parsed and validated representation of the model's `.json` file.
    -   `.moc`: Path to the `.moc` or `.moc3` file.
    -   `.textures`: Array of texture paths.
    -   `.motions`: Definitions of all motion groups.
    -   `.expressions`: Definitions of all expressions.
    -   `.resolveURL(path)`: Resolves a relative resource path against the model's base URL.
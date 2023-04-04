# BucketQueue
A simple queue that batches items together and releases them periodically. Useful for processing large sets of data in batches.

## Installation
To install the library using npm, run:

```bash
npm install bucketqueue
```

## Usage
The library can be used with both TypeScript and CommonJS. Here are some examples of how to use it:

### Typescript
```typescript
import BucketQueue from 'bucketqueue';

const queue = new BucketQueue<string>({
  interval: 1000,
  maxBatch: 100,
  minBatch: 10,
  onSpill: (items) => {
    console.log(`Spilled ${items.length} items`);
  },
});

queue.push('item 1');
queue.push('item 2');
queue.push('item 3');
```

### Javascript
```javascript
const BucketQueue = require('bucketqueue').default;

const queue = new BucketQueue({
  interval: 1000,
  maxBatch: 100,
  minBatch: 10,
  onSpill: (items) => {
    console.log(`Spilled ${items.length} items`);
  },
});

queue.push('item 1');
queue.push('item 2');
queue.push('item 3');
```

## API

For full API documentation, see [TypeDoc Documentation](https://jakguru.github.io/BucketQueue/)

The following properties, methods and events are available:

### `options: BucketQueueOptions`
Returns the options object used to create the queue.

### `pressure: number`
Returns the number of items in the queue.

### `push(...items: T[])`
Adds one or more items to the queue.

### `add(...items: T[])`
Alias for `push`.

### `enqueue(...items: T[])`
Alias for `push`.

### `start(): void`
Starts the queue.

### `stop(): void`
Stops the queue.

### `pause(): void`
Pauses the queue.

### `resume(): void`
Resumes the queue.

### `remove(item: T): void`
Removes an item from the queue.

### `dequeue(item: T): void`
Alias for `remove`.

### `on(event: string, listener: Function): void`
Adds a listener to an event. The following events are available:

* `tick`
* `spill`
* `spilled`
* `drain`
* `finish`
* `error`
* `pipe`
* `unpipe`
* `corked`
* `uncorked`

## Contributing
If you would like to contribute to this project, feel free to open a pull request or an issue on the GitHub repository. All contributions are welcome!
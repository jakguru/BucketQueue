import { EventEmitter } from 'events'

/**
 * Represents an object of event handlers used by the BucketQueue class.
 * @typeparam T The type of items being handled by the event handlers.
 */
export type BucketQueueEventHandlers<T = any> = {
  /**
   * Handles the "tick" event, which is triggered on each interval if the bucket queue is not empty.
   * @param timestamp The timestamp when the event was triggered.
   * @param pressure The number of items currently in the bucket queue.
   */
  tick: (timestamp: number, pressure: number) => void
  /**
   * Handles the "spill" event, which is triggered when the bucket queue reaches its maximum batch size and spills.
   * @param timestamp The timestamp when the event was triggered.
   * @param pressure The number of items currently in the bucket queue.
   */
  spill: (timestamp: number, pressure: number) => void
  /**
   * Handles the "spilled" event, which is triggered when the bucket queue has spilled and reduced its pressure.
   * @param timestamp The timestamp when the event was triggered.
   * @param pressure The number of items currently in the bucket queue.
   * @param prevPressure The number of items in the bucket queue before it spilled.
   */
  spilled: (timestamp: number, pressure: number, prevPressure: number) => void
  /**
   * Handles the "drain" event, which is triggered when the bucket queue becomes empty.
   */
  drain: () => void
  /**
   * Handles the "finish" event, which is triggered when the bucket queue becomes empty and no more items are expected to be added.
   */
  finish: () => void
  /**
   * Handles the "error" event, which is triggered when an error occurs while processing items in the bucket queue.
   * @param error The error object that was thrown.
   * @param itemOrItems The item or items that caused the error.
   */
  error: (error: Error | null | undefined, itemOrItems?: T | T[]) => void
  /**
   * Handles the "pipe" event, which is triggered when items are added to the bucket queue.
   * @param items An array of items that were added to the bucket queue.
   */
  pipe: (items: T[]) => void
  /**
   * Handles the "unpipe" event, which is triggered when items are removed from the bucket queue.
   * @param items An array of items that were removed from the bucket queue.
   */
  unpipe: (items: T[]) => void
  /**
   * Handles the "corked" event, which is triggered when the bucket queue is corked.
   */
  corked: () => void
  /**
   * Handles the "uncorked" event, which is triggered when the bucket queue is uncorked.
   */
  uncorked: () => void
}

/**
 * An interface that defines the methods for an event emitter for the `BucketQueue` class.
 *
 * @template T The type of the items in the `BucketQueue`.
 */
export interface BucketQueueEmitter<T = any> {
  /**
   * Adds a listener function to the specified event.
   *
   * @param eventName The name of the event to add a listener for.
   * @param listener The function to be called when the event is emitted.
   * @returns void
   */
  on<K extends keyof BucketQueueEventHandlers<T>>(
    eventName: K,
    listener: BucketQueueEventHandlers<T>[K]
  ): void

  /**
   * Removes a listener function from the specified event.
   *
   * @param eventName The name of the event to remove the listener from.
   * @param listener The function to be removed from the listeners of the event.
   * @returns void
   */
  off<K extends keyof BucketQueueEventHandlers<T>>(
    eventName: K,
    listener: BucketQueueEventHandlers<T>[K]
  ): void

  /**
   * Calls each of the listeners registered for the specified event.
   *
   * @param eventName The name of the event to emit.
   * @param args The arguments to be passed to the event listeners.
   * @returns void
   */
  emit<K extends keyof BucketQueueEventHandlers<T>>(
    eventName: K,
    ...args: Parameters<BucketQueueEventHandlers<T>[K]>
  ): void
}

/**
 * Defines a callback function for handling spilled items in the queue.
 * @typeparam T Type of items in the queue.
 * @param items An array of items that spilled.
 * @returns A void or a promise resolving to void.
 */
export interface BucketQueueSpillCallback<T = any> {
  (items: T[]): void | Promise<void>
}

/**
 * Defines a callback function for handling individual items in the queue.
 * @typeparam T Type of items in the queue.
 * @param item An item in the queue.
 * @returns A void or a promise resolving to void.
 */
export interface BucketQueueItemCallback<T = any> {
  (item: T): void | Promise<void>
}

/**
 * Defines the configuration options for the BucketQueue class.
 * @typeparam T Type of items in the queue.
 */
export interface BucketQueueOptions<T = any> {
  interval: number
  minBatch: number
  maxBatch: number
  onSpill?: BucketQueueSpillCallback<T>
  onItem?: BucketQueueItemCallback<T>
  ignoreSmallIntervalWarning?: boolean
  ignoreBigBatchWarning?: boolean
  autostart?: boolean
  chunkSize?: number
}

/**
 * Defines the configuration options for the BucketQueue class with defaulted options.
 * @extends BucketQueueOptions
 */
export interface BucketQueuePopulatedOptions extends BucketQueueOptions {
  ignoreSmallIntervalWarning: boolean
  ignoreBigBatchWarning: boolean
  autostart: boolean
  chunkSize: number
}

/**
 * Defines an object that represents events stored during the construction of the BucketQueue class.
 */
export interface ConstructionEventsObject {
  [key: string]: Array<any>
}

/**
 * Defines an array of arguments that can be passed to the push method of the BucketQueue class.
 * @typeparam T Type of items in the queue.
 */
export type BucketQueuePushArguments<T = any> = Array<T>

/**
 * An object containing default options for a BucketQueue.
 * @type {Pick<BucketQueuePopulatedOptions, 'interval' | 'minBatch' | 'maxBatch' | 'ignoreSmallIntervalWarning' | `ignoreBigBatchWarning` | 'autostart' | 'chunkSize'>}
 */
const BucketQueueDefaultOptions: Pick<
  BucketQueuePopulatedOptions,
  | 'interval'
  | 'minBatch'
  | 'maxBatch'
  | 'ignoreSmallIntervalWarning'
  | `ignoreBigBatchWarning`
  | 'autostart'
  | 'chunkSize'
> = {
  interval: 1000,
  minBatch: 0,
  maxBatch: 50,
  ignoreSmallIntervalWarning: false,
  ignoreBigBatchWarning: false,
  autostart: true,
  chunkSize: 1000000,
}

/**
 * A queue that batches and delays items to limit concurrent processing and reduce external API load.
 * @typeparam T Type of items in the queue.
 * @extends EventEmitter
 */
export default class BucketQueue<T = any> extends EventEmitter implements BucketQueueEmitter<T> {
  /**
   * A map containing stored events.
   */
  readonly #storedEvents: Map<string, Set<any>> = new Map()
  /**
   * An array of items in the queue.
   */
  readonly #bucket: T[] = []
  /**
   * The time interval (in milliseconds) between each batch of items processed by the queue.
   */
  readonly #interval: number
  /**
   * The minimum number of items required in the queue for a batch to be processed.
   */
  readonly #minBatch: number
  /**
   * The maximum number of items that can be processed in a single batch.
   */
  readonly #maxBatch: number
  /**
   * The maximum size of chunks when splitting items into smaller arrays.
   */
  readonly #chunkSize: number
  /**
   * A callback function for handling spilled items in the queue.
   */
  readonly #onSpill: BucketQueueSpillCallback<T> | undefined
  /**
   * A callback function for handling individual items in the queue.
   */
  readonly #onItem: BucketQueueItemCallback<T> | undefined
  /**
   * The current immediate object used to schedule the next tick.
   */
  #immediate: NodeJS.Immediate | undefined
  /**
   * A flag indicating whether the queue is currently corked (stopped).
   */
  #corked: boolean = false
  /**
   * The timestamp (in milliseconds) of the last time the queue started processing items.
   */
  #lastStart: number = 0
  /**
   * The timestamp (in milliseconds) of the last time the queue ended processing items.
   */
  #lastEnd: number = 0
  /**
   * A flag indicating whether the queue has been touched (a listener has been added).
   */
  #touched: boolean = false

  /**
   * Constructs a new BucketQueue object.
   * @constructor
   * @param {BucketQueueOptions<T>} options - An object containing the options for this BucketQueue.
   * @throws {Error} If the provided options do not meet the requirements.
   */
  constructor(options: BucketQueueOptions<T>) {
    super({
      captureRejections: true,
    })
    this.once('newListener', () => {
      this.#touched = true
      setImmediate(() => {
        this.#storedEvents.forEach((events, eventName) => {
          events.forEach((event) => {
            this.emit(eventName, ...event)
            this.#storedEvents.delete(eventName)
          })
        })
      })
    })
    const opts = Object.assign(
      {},
      BucketQueueDefaultOptions,
      options
    ) as BucketQueuePopulatedOptions
    if (opts.interval < 0) {
      throw new Error('interval must be a non negative number')
    }
    if (opts.interval < 100) {
      const warning = new Error(
        'interval less than 100 (100ms) can cause unpredicatable behavior. See https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#late_timeouts'
      )
      if (opts.ignoreSmallIntervalWarning) {
        this.#storeAndEmit('warning', warning)
      } else {
        throw warning
      }
    }
    if (opts.minBatch < 0) {
      throw new Error('minBatch must be a non negative number')
    }
    if (opts.maxBatch <= opts.minBatch) {
      throw new Error('maxBatch must be larger than minBatch')
    }
    if (opts.maxBatch > 100000) {
      const warning = new Error(
        'batches greater than 1000000 will be split into 1000000 chunks in order to avoid a "TooManyElementsInPromiseAll" error. See https://stackoverflow.com/a/55754035/10645758 for more information.'
      )
      if (opts.ignoreBigBatchWarning) {
        this.#storeAndEmit('warning', warning)
      } else {
        throw warning
      }
    }
    if (opts.chunkSize <= 0) {
      throw new Error('chunkSize must be a positive number greater than 0')
    }
    if (opts.chunkSize > 1000000) {
      throw new Error(
        'chunkSize must be less than or equal to 1000000 in order to avoid a "TooManyElementsInPromiseAll" error. See https://stackoverflow.com/a/55754035/10645758 for more information.'
      )
    }
    if ('function' !== typeof opts.onSpill && 'function' !== typeof opts.onItem) {
      throw new Error('Either onSpill or onItem must be defined as functions')
    }
    if ('function' === typeof opts.onSpill && 'function' === typeof opts.onItem) {
      throw new Error('onSpill and onItem cannot be defined at the same time')
    }
    this.#interval = opts.interval
    this.#minBatch = opts.minBatch
    this.#maxBatch = opts.maxBatch
    this.#chunkSize = opts.chunkSize
    this.#onSpill = opts.onSpill
    this.#onItem = opts.onItem
    if (opts.autostart) {
      process.nextTick(() => {
        this.#tick()
      })
    }
  }

  /**
   * Async method that represents a single execution cycle of the BucketQueue. Spills if there are enough items in the queue and enough time has passed.
   * @private
   * @returns {Promise<void>}
   */
  async #tick() {
    const startListSize = this.#bucket.length
    this.#storeAndEmit('tick', this.#getTimestamp(), startListSize)
    if (!this.#corked && this.#enoughTimeHasElappsed && this.#bucket.length >= this.#minBatch) {
      this.#storeAndEmit('spill', this.#getTimestamp(), startListSize)
      this.#lastStart = this.#getTimestamp()
      const items = this.#bucket.splice(0, this.#maxBatch)
      if ('function' === typeof this.#onSpill) {
        const chunks = this.#chunk(items, this.#chunkSize)
        for (const chunk of chunks) {
          try {
            await this.#onSpill(chunk)
          } catch (error) {
            this.#storeAndEmit('error', error, items)
          }
        }
      } else if ('function' === typeof this.#onItem) {
        const chunks = this.#chunk(items, this.#chunkSize)
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(async (i: T) => {
              try {
                await (this.#onItem as BucketQueueItemCallback)(i)
              } catch (error) {
                this.#storeAndEmit('error', error, i)
              }
            })
          )
        }
      }
      this.#lastEnd = this.#getTimestamp()
      this.#storeAndEmit('spilled', this.#getTimestamp(), this.#bucket.length, startListSize)
      this.#storeAndEmit('timing', this.#lastEnd - this.#lastStart, items.length)
    }
    const endListSize = this.#bucket.length
    if (startListSize !== endListSize) {
      if (endListSize < this.#maxBatch) {
        this.#storeAndEmit('drain')
      }
      if (endListSize === 0) {
        this.#storeAndEmit('finish')
      }
    }
    if (!this.#corked) {
      this.#immediate = setImmediate(() => {
        this.#tick()
      })
    }
  }

  /**
   * Returns true if enough time has elapsed since the last time the bucket spilled
   */
  get #enoughTimeHasElappsed() {
    const now = this.#getTimestamp()
    const elapsed = now - this.#lastEnd
    return elapsed >= this.#interval
  }

  /**
   * Returns the current timestamp in milliseconds
   * @returns {number} The current timestamp in milliseconds
   */
  #getTimestamp() {
    return Date.now()
  }

  /**
   * Splits an array into chunks of specified size.
   * @param array - The array to be split.
   * @param size - The size of each chunk. Default is 1000000.
   * @returns An array containing chunks of the original array, each of size size except for possibly the last one.
   */
  #chunk(array: any[], size: number = 1000000) {
    size = Math.max(Math.round(size), 0)
    const length = array.length
    if (!length || size < 1) {
      return []
    }
    let index = 0
    let resIndex = 0
    const result = new Array(Math.ceil(length / size))

    while (index < length) {
      result[resIndex++] = array.slice(index, (index += size))
    }
    return result
  }

  /**
   * Store and emit an event if the instance has already been touched.
   * If the instance has not been touched, store the event and its arguments
   * in this.#storedEvents for later emission upon the first listener.
   * @param event - The name of the event.
   * @param args - Optional arguments to pass to the event.
   */
  #storeAndEmit(event: string, ...args: any[]) {
    if (this.#touched) {
      this.emit(event, ...args)
    } else if (!['tick'].includes(event)) {
      if (!this.#storedEvents.has(event)) {
        this.#storedEvents.set(event, new Set())
      }
      this.#storedEvents.get(event)?.add(args)
    }
  }

  /**
   * Returns the current options object used by the BucketQueue.
   * The returned object is frozen and cannot be modified.
   *
   * @returns An object containing the current options of the BucketQueue.
   */
  public get options() {
    const opts = {
      interval: this.#interval,
      minBatch: this.#minBatch,
      maxBatch: this.#maxBatch,
    }
    Object.freeze(opts)
    return opts
  }

  /**
   * Returns a frozen object containing all stored construction events.
   * The object keys represent the event types and the values are arrays of event arguments.
   * Note that this method only returns stored construction events that have not been emitted yet.
   * Once an event is emitted, it will be removed from the stored events map.
   */
  public get constructionEvents() {
    const evnts: ConstructionEventsObject = {}
    this.#storedEvents.forEach((value, key) => {
      evnts[key] = [...value]
    })
    this.#storedEvents.forEach((_value, key) => {
      Object.freeze(evnts[key])
    })
    Object.freeze(evnts)
    return evnts
  }

  /**
   * Returns the current length of the bucket, representing the number of items waiting to be processed.
   * @returns The current length of the bucket.
   */
  public get pressure() {
    return this.#bucket.length
  }

  /**
   * Pushes items to the bucket and emits the 'pipe' and 'unpipe' events.
   * @param items The items to push to the bucket.
   */
  public push(...items: BucketQueuePushArguments<T>) {
    this.#storeAndEmit('pipe', items)
    this.#bucket.push(...items)
    this.#storeAndEmit('unpipe', items)
  }

  /**
   * Alias for push() method.
   * @param items The items to add to the bucket.
   */
  public add(...items: BucketQueuePushArguments<T>) {
    this.push.apply(this, items)
  }

  /**
   * Alias for push() method.
   * @param items The items to enqueue to the bucket.
   */
  public enqueue(...items: BucketQueuePushArguments<T>) {
    this.push.apply(this, items)
  }

  /**
   * Remove an item from the queue if it exists.
   *
   * @param item - The item to remove.
   */
  public remove(item: T) {
    const index = this.#bucket.indexOf(item)
    if (index > -1) {
      this.#bucket.splice(index, 1)
    }
    if (this.#bucket.length < this.#maxBatch) {
      this.#storeAndEmit('drain')
    }
  }

  /**
   * Alias for the `remove` method.
   *
   * @param item - The item to remove.
   */
  public dequeue(item: T) {
    this.remove(item)
  }

  /**
   * Pause the BucketQueue by corking it, preventing any more events from processing.
   * @returns void
   */
  public cork() {
    clearImmediate(this.#immediate)
    this.#corked = true
    this.#storeAndEmit('corked')
  }

  /**
   * Resume the BucketQueue by uncorking it, allowing events to continue processing.
   * @returns void
   */
  public uncork() {
    this.#corked = false
    process.nextTick(() => this.#tick.bind(this))
    this.#storeAndEmit('uncorked')
  }

  /**
   * Alias for {@link BucketQueue.#cork}.
   * @returns void
   */
  public pause() {
    this.cork()
  }

  /**
   * Alias for {@link BucketQueue.#uncork}.
   * @returns void
   */
  public resume() {
    this.uncork()
  }
}

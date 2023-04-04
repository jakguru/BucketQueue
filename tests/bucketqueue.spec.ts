import { test } from '@japa/runner'

import BucketQueue from '../bucketqueue'

test.group('Bucket Queue', () => {
  test('it should add items to the queue', async ({ assert }) => {
    const queue = new BucketQueue({
      interval: 1000,
      minBatch: 0,
      maxBatch: 10,
      onItem: () => {},
      autostart: false,
    })
    queue.add('item 1', 'item 2')
    assert.equal(queue.pressure, 2)
  })

  test('it should remove items from the queue', async ({ assert }) => {
    const queue = new BucketQueue({
      interval: 1000,
      minBatch: 0,
      maxBatch: 10,
      onItem: () => {},
      autostart: false,
    })
    queue.add('item 1', 'item 2')
    queue.remove('item 1')
    assert.equal(queue.pressure, 1)
  })

  test('it should emit events when items are added or removed from the queue', async ({
    assert,
  }) => {
    const queue = new BucketQueue({ interval: 1000, minBatch: 0, maxBatch: 10, onItem: () => {} })
    const events: string[] = []
    queue.on('pipe', (items: any[]) => {
      events.push(`pipe ${items.length}`)
    })
    queue.on('unpipe', (items: any[]) => {
      events.push(`unpipe ${items.length}`)
    })
    queue.add('item 1', 'item 2')
    queue.remove('item 1')
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.deepEqual(events, ['pipe 2', 'unpipe 2'])
    queue.cork()
  })

  test('it should emit a "drain" event when the queue will run immediatly', async ({ assert }) => {
    const queue = new BucketQueue({ interval: 1000, minBatch: 0, maxBatch: 10, onItem: () => {} })
    const events: string[] = []
    queue.on('drain', () => {
      events.push('drain')
    })
    queue.enqueue('item 1', 'item 2')
    queue.dequeue('item 1')
    queue.dequeue('item 2')
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.deepEqual(events, ['drain', 'drain'])
    queue.cork()
  })

  test('it should emit a "finish" event when the queue is empty and will run immediatly', async ({
    assert,
  }) => {
    const queue = new BucketQueue({
      interval: 100,
      minBatch: 0,
      maxBatch: 10,
      onItem: (item: any) => {
        assert.oneOf(item, ['item 1', 'item 2'])
      },
    })
    const events: string[] = []
    queue.on('finish', () => {
      events.push('finish')
    })
    queue.add('item 1', 'item 2')
    await new Promise((resolve) => setTimeout(resolve, 110))
    assert.deepEqual(events, ['finish'])
    queue.cork()
  })

  test('it should call the onSpill callback when the queue spills', async ({ assert }) => {
    const queue = new BucketQueue({
      interval: 1000,
      minBatch: 0,
      maxBatch: 10,
      onSpill: (items: any[]) => {
        assert.deepEqual(items, ['item 1', 'item 2', 'item 3', 'item 4'])
      },
    })
    queue.add('item 1', 'item 2', 'item 3', 'item 4')
    await new Promise((resolve) => setTimeout(resolve, 1100))
    queue.cork()
  })

  test('it should call the onItem callback for each item when the queue spills', async ({
    assert,
  }) => {
    const queue = new BucketQueue({
      interval: 1000,
      minBatch: 0,
      maxBatch: 10,
      onItem: async (item) => {
        assert.oneOf(item, ['item 1', 'item 2', 'item 3', 'item 4'])
      },
    })
    queue.add('item 1', 'item 2', 'item 3', 'item 4')
    await new Promise((resolve) => setTimeout(resolve, 1100))
    queue.cork()
  })

  test('it should throw an error when interval is less than 0', async ({ assert }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: -1,
        minBatch: 0,
        maxBatch: 10,
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(error.message, 'interval must be a non negative number')
    }
  })

  test('it should throw an error when minBatch is less than 0', async ({ assert }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 1000,
        minBatch: -1,
        maxBatch: 10,
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(error.message, 'minBatch must be a non negative number')
    }
  })

  test('it should throw an error when maxBatch is less than or equal to minBatch', async ({
    assert,
  }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 1000,
        minBatch: 10,
        maxBatch: 10,
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(error.message, 'maxBatch must be larger than minBatch')
    }
  })

  test('it should throw an error when interval is less than 100 and ignoreSmallIntervalWarning is false', async ({
    assert,
  }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 50,
        minBatch: 0,
        maxBatch: 10,
        ignoreSmallIntervalWarning: false,
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(
        error.message,
        'interval less than 100 (100ms) can cause unpredicatable behavior. See https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#late_timeouts'
      )
    }
  })

  test('it should emit a warning when interval is less than 100 and ignoreSmallIntervalWarning is true', async ({
    assert,
  }) => {
    const queue = new BucketQueue({
      interval: 50,
      minBatch: 0,
      maxBatch: 10,
      ignoreSmallIntervalWarning: true,
      onItem: () => {},
      autostart: false,
    })
    const events: string[] = []
    queue.on('warning', (error: Error) => {
      events.push(error.message)
    })
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.deepEqual(events, [
      'interval less than 100 (100ms) can cause unpredicatable behavior. See https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#late_timeouts',
    ])
  })

  test('it should throw an error when maxBatch is greater than 100000 and ignoreBigBatchWarning is false', async ({
    assert,
  }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 1000,
        minBatch: 0,
        maxBatch: 100001,
        ignoreBigBatchWarning: false,
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(
        error.message,
        'batches greater than 1000000 will be split into 1000000 chunks in order to avoid a "TooManyElementsInPromiseAll" error. See https://stackoverflow.com/a/55754035/10645758 for more information.'
      )
    }
  })

  test('it should emit a warning when maxBatch is greater than 100000 and ignoreBigBatchWarning is true', async ({
    assert,
  }) => {
    const queue = new BucketQueue({
      interval: 1000,
      minBatch: 0,
      maxBatch: 100001,
      ignoreBigBatchWarning: true,
      onItem: () => {},
      autostart: false,
    })
    const events: string[] = []
    queue.on('warning', (error: Error) => {
      events.push(error.message)
    })
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.deepEqual(events, [
      'batches greater than 1000000 will be split into 1000000 chunks in order to avoid a "TooManyElementsInPromiseAll" error. See https://stackoverflow.com/a/55754035/10645758 for more information.',
    ])
  })

  test('it should throw an error when chunkSize is less than or equal to 0', async ({ assert }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 1000,
        minBatch: 10,
        maxBatch: 1000,
        chunkSize: 0,
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(error.message, 'chunkSize must be a positive number greater than 0')
    }
  })

  test('it should throw an error when chunkSize is greater than 1000000', async ({ assert }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 1000,
        minBatch: 10,
        maxBatch: 1000,
        chunkSize: 1000001,
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(
        error.message,
        'chunkSize must be less than or equal to 1000000 in order to avoid a "TooManyElementsInPromiseAll" error. See https://stackoverflow.com/a/55754035/10645758 for more information.'
      )
    }
  })

  test('it should throw an error when neither onSpill or onItem are defined', async ({
    assert,
  }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 1000,
        minBatch: 10,
        maxBatch: 1000,
        chunkSize: 1,
        autostart: false,
      })
    } catch (error) {
      assert.equal(error.message, 'Either onSpill or onItem must be defined as functions')
    }
  })

  test('it should throw an error when both onSpill or onItem are defined', async ({ assert }) => {
    assert.plan(1)
    try {
      new BucketQueue({
        interval: 1000,
        minBatch: 10,
        maxBatch: 1000,
        chunkSize: 1,
        onSpill: () => {},
        onItem: () => {},
        autostart: false,
      })
    } catch (error) {
      assert.equal(error.message, 'onSpill and onItem cannot be defined at the same time')
    }
  })

  test('the wait time between the bucket being spilled should be more than the interval value in ms', async ({
    assert,
  }) => {
    assert.plan(1)
    let queue: BucketQueue<number> | undefined
    const timeBetweenSpills: number = await new Promise((resolve) => {
      let startTime: number | undefined
      let endTime: number | undefined
      queue = new BucketQueue({
        interval: 500,
        minBatch: 0,
        maxBatch: 1,
        onItem: (val: number) => {
          if (val === 2) {
            endTime = Date.now()
            if (!endTime || !startTime) {
              return resolve(0)
            }
            return resolve(endTime - startTime)
          }
        },
      })
      queue.add(1)
      startTime = Date.now()
      queue.add(2)
    })
    queue?.cork()
    assert.isAtLeast(timeBetweenSpills, 500)
  })

  test('it should emit an error when onSpill throws an error', async ({ assert }) => {
    let queue: BucketQueue | undefined
    // @ts-ignore
    const [error, items] = await new Promise((resolve) => {
      queue = new BucketQueue({
        interval: 1000,
        minBatch: 1,
        maxBatch: 100000,
        onSpill: () => {
          throw new Error('errored successfully')
        },
        autostart: true,
      })
      queue.on('error', (error: Error, items) => {
        return resolve([error, items])
      })
      queue.add(1)
    })
    queue?.cork()
    assert.deepEqual(error, new Error('errored successfully'))
    assert.deepEqual(items, [1])
  })

  test('it should emit an error when onItem throws an error', async ({ assert }) => {
    let queue: BucketQueue | undefined
    // @ts-ignore
    const [error, item] = await new Promise((resolve) => {
      queue = new BucketQueue({
        interval: 1000,
        minBatch: 1,
        maxBatch: 100000,
        onItem: () => {
          throw new Error('errored successfully')
        },
        autostart: true,
      })
      queue.on('error', (error: Error, item) => {
        return resolve([error, item])
      })
      queue.add(1)
    })
    queue?.cork()
    assert.deepEqual(error, new Error('errored successfully'))
    assert.deepEqual(item, 1)
  })

  test('BucketQueue.options should return a frozen object of options', async ({ assert }) => {
    const queue = new BucketQueue({
      interval: 1000,
      minBatch: 5,
      maxBatch: 10,
      ignoreBigBatchWarning: true,
      onItem: () => {},
      autostart: false,
    })
    assert.deepEqual(queue.options, {
      interval: 1000,
      minBatch: 5,
      maxBatch: 10,
    })
    assert.ok(Object.isFrozen(queue.options))
  })

  test('BucketQueue.constructionEvents should return a frozen object of events', async ({
    assert,
  }) => {
    const queue = new BucketQueue({
      interval: 1000,
      minBatch: 0,
      maxBatch: 10,
      onItem: () => {},
      autostart: true,
    })
    queue.push(1, 2, 3)
    queue.pause()
    queue.push(4, 5)
    queue.resume()
    queue.push(6)
    queue.push(7)
    queue.cork()
    assert.deepEqual(queue.constructionEvents, {
      pipe: [[[1, 2, 3]], [[4, 5]], [[6]], [[7]]],
      unpipe: [[[1, 2, 3]], [[4, 5]], [[6]], [[7]]],
      corked: [[], []],
      uncorked: [[]],
    })
    assert.ok(Object.isFrozen(queue.constructionEvents))
  })
})

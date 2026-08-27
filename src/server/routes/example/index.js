import Joi from 'joi'

import {
  exampleFailAction,
  exampleGetController,
  examplePostController
} from './controller.js'

const maxExampleTextLength = 255

/**
 * Sets up the routes used in the /example page.
 * These routes inherit the default session auth, so they are logged-in only.
 */
export const example = {
  plugin: {
    name: 'example',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/example',
          ...exampleGetController
        },
        {
          method: 'POST',
          path: '/example',
          options: {
            validate: {
              payload: Joi.object({
                exampleText: Joi.string()
                  .trim()
                  .min(1)
                  .max(maxExampleTextLength)
                  .required()
              }).unknown(true),
              failAction: exampleFailAction
            }
          },
          ...examplePostController
        }
      ])
    }
  }
}

import {FastifyPluginAsync} from 'fastify'
import {prisma} from '../../lib/prisma'
import {Prisma } from "../../generated/prisma/client"
import type {User} from "../../generated/prisma/client"

type JSONAPIError = { detail: string }
type WrappedData<T> = { data: T } | { errors: JSONAPIError[] }

const dataWrapper = <T>(unwrapped: T): WrappedData<T> => ({data: unwrapped})

const crud: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    // index
    type UserGetAll = { Querystring: { page?: string; limit?: string }, Reply: WrappedData<User[]> }
    fastify.get<UserGetAll>('/', async (request, reply) => {
        // dont allow page to be < 1
        const page = Math.max(1, parseInt(request.query.page ?? '1'))
        // default 10 and at most 100
        const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '10')))

        const skip = (page - 1) * limit

        const users = await prisma.user.findMany({
            skip,
            take: limit,
            orderBy: { id: 'asc' },
        })

        return reply.send(dataWrapper(users))
    })

    // show
    type IdParam = { id: string }
    type UserGet = { Params: IdParam, Reply: WrappedData<User | null> }
    fastify.get<UserGet>('/:id', async function (request, reply) {
        const id = Number.parseInt(request.params.id)
        if (Number.isNaN(id)) return reply.code(400).send({errors: [{detail: 'Invalid ID'}]})

        const user = await prisma.user.findUnique({
            where: {
                id: id
            }
        })

        if (!user) return reply.code(404).send({ errors: [{ detail: 'User not found' }]})

        return reply.send(dataWrapper(user))
    })

    // store
    type UserBody = { email: string, name: string }
    type UserPost = { Body: UserBody, Reply: WrappedData<User> }
    fastify.post<UserPost>('/', async function (request, reply) {
        try {
            const user = await prisma.user.create({
                data: {
                    email: request.body.email,
                    name: request.body.name,
                }
            })

            return reply.code(201).send(dataWrapper(user))
        } catch {
            return reply.code(400).send({ errors: [{ detail: 'Invalid request' }]})
        }
    })

    // update
    type UserPut = { Params: IdParam, Body: UserBody, Reply: WrappedData<User> }
    fastify.put<UserPut>('/:id', async function (request, reply) {
        const id = Number.parseInt(request.params.id)
        if (Number.isNaN(id)) return reply.code(400).send({errors: [{detail: 'Invalid ID'}]})

        try {
            const updatedUser = await prisma.user.update({
                where: {
                    id: id
                },
                data: {
                    email: request.body.email,
                    name: request.body.name,
                }
            })

            return reply.send(dataWrapper(updatedUser))
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError) {
                // not found
                if (e.code === 'P2025') return reply.code(404).send({ errors: [{ detail: 'User not found' }]})
            }

            return reply.code(400).send({ errors: [{ detail: 'Invalid request' }]})
        }
    })

    // destroy
    type UserDelete = { Params: IdParam }
    fastify.delete<UserDelete>('/:id', async function (request, reply) {
        const id = Number.parseInt(request.params.id)
        if (Number.isNaN(id)) return reply.code(400).send({errors: [{detail: 'Invalid ID'}]})

        try {
            await prisma.user.delete({
                where: {
                    id: id
                }
            })

            return reply.code(204).send()
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError) {
                // not found
                if (e.code === 'P2025') return reply.code(404).send({ errors: [{ detail: 'User not found' }]})
            }

            return reply.code(400).send({ errors: [{ detail: 'Invalid request' }]})
        }
    })
}

export default crud

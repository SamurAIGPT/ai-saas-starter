import { prisma } from "../prisma";
import { validateCreditCost } from "../security.mjs";

export const UserService = {
  async getCredits(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    return user ? user.credits : 0;
  },

  async addCredits(userId, amount, client = prisma) {
    const value = validateCreditCost(amount, 1_000_000);
    return client.user.update({
      where: { id: userId },
      data: { credits: { increment: value } },
    });
  },

  async deductCredits(userId, amount) {
    const cost = validateCreditCost(amount);
    const result = await prisma.user.updateMany({
      where: { id: userId, credits: { gte: cost } },
      data: { credits: { decrement: cost } },
    });
    if (result.count !== 1) {
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists) throw new Error("User not found");
      throw new Error("Insufficient credits available");
    }
    return this.getCredits(userId);
  },
};

export const getCredits = UserService.getCredits.bind(UserService);
export const addCredits = UserService.addCredits.bind(UserService);
export const deductCredits = UserService.deductCredits.bind(UserService);
export default UserService;

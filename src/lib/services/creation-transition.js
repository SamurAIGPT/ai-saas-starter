import { prisma } from "../prisma";

export async function transitionCreationAndMaybeRefund(creation, data, shouldRefund = false) {
  return prisma.$transaction(async (tx) => {
    const transition = await tx.creation.updateMany({
      where: { id: creation.id, status: "processing" },
      data,
    });

    if (transition.count !== 1) return false;

    if (shouldRefund && creation.creditCost > 0) {
      await tx.user.update({
        where: { id: creation.userId },
        data: { credits: { increment: creation.creditCost } },
      });
    }

    return true;
  });
}

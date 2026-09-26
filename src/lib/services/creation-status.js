import { prisma } from "../prisma";

export async function settleCreation(creationId, { status, resultImage = null, error = null, include }) {
  if (!["completed", "failed"].includes(status)) throw new Error("Invalid terminal creation status");
  if (status === "completed" && (typeof resultImage !== "string" || !resultImage)) {
    throw new Error("Completed creation requires an output URL");
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.creation.findUnique({ where: { id: creationId } });
    if (!current) return null;
    if (current.status !== "processing") return include ? tx.creation.findUnique({ where: { id: creationId }, include }) : current;

    const changed = await tx.creation.updateMany({
      where: { id: creationId, status: "processing" },
      data: {
        status,
        resultImage: status === "completed" ? resultImage : null,
        error: status === "failed" ? String(error || "Generation failed").slice(0, 2000) : null,
      },
    });
    if (changed.count !== 1) return tx.creation.findUnique({ where: { id: creationId }, ...(include && { include }) });

    if (status === "failed" && current.creditCost > 0) {
      await tx.user.update({
        where: { id: current.userId },
        data: { credits: { increment: current.creditCost } },
      });
    }
    return tx.creation.findUnique({ where: { id: creationId }, ...(include && { include }) });
  });
}

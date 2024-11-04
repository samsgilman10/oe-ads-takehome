PREPARE ad_counts (INTEGER, DATE, DATE) AS
    SELECT "Category"."name" as "categoryName", COUNT("Question"."id") AS "adCount"
    FROM "Question" INNER JOIN "Category" ON "Question"."categoryId" = "Category"."id"
    WHERE "partnerId" = $1 and "Question"."askedAt" BETWEEN $2 AND $3
    GROUP BY "Category"."name";
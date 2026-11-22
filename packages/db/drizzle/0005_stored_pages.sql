-- Pages outside the digitize range stay on the book until asked for later.
ALTER TYPE "public"."book_page_status" ADD VALUE IF NOT EXISTS 'stored';

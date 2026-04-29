drop trigger if exists "handle_updated_at" on "public"."rooms";

drop policy "Allow public insert" on "public"."rooms";

drop policy "Allow public read" on "public"."rooms";

drop policy "Allow public update" on "public"."rooms";

revoke delete on table "public"."rooms" from "anon";

revoke insert on table "public"."rooms" from "anon";

revoke references on table "public"."rooms" from "anon";

revoke select on table "public"."rooms" from "anon";

revoke trigger on table "public"."rooms" from "anon";

revoke truncate on table "public"."rooms" from "anon";

revoke update on table "public"."rooms" from "anon";

revoke delete on table "public"."rooms" from "authenticated";

revoke insert on table "public"."rooms" from "authenticated";

revoke references on table "public"."rooms" from "authenticated";

revoke select on table "public"."rooms" from "authenticated";

revoke trigger on table "public"."rooms" from "authenticated";

revoke truncate on table "public"."rooms" from "authenticated";

revoke update on table "public"."rooms" from "authenticated";

revoke delete on table "public"."rooms" from "service_role";

revoke insert on table "public"."rooms" from "service_role";

revoke references on table "public"."rooms" from "service_role";

revoke select on table "public"."rooms" from "service_role";

revoke trigger on table "public"."rooms" from "service_role";

revoke truncate on table "public"."rooms" from "service_role";

revoke update on table "public"."rooms" from "service_role";

alter table "public"."rooms" drop constraint "rooms_pkey";

drop index if exists "public"."rooms_pkey";

drop table "public"."rooms";



"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { signUp } from "@/lib/auth-client";
import { SignUpInput, signUpSchema } from "@/lib/validations/auth";

export default function SignUpPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignUpInput) => {
    await signUp.email(values, {
      onSuccess: () => {
        router.push("/dashboard");
      },
      onError: (ctx) => {
        alert(ctx.error.message);
      },
    });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <p className="font-serif text-3xl font-bold text-primary">
            milyo
          </p>

          <h1 className="mt-8 font-serif text-2xl font-bold text-foreground">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Join Milyo and start managing your campus reports.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Full Name
            </label>

            <input
              {...register("name")}
              type="text"
              placeholder="John Doe"
              className={cn(
                "w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none transition",
                "placeholder:text-muted-foreground",
                errors.name
                  ? "border-red-500 focus:border-red-500"
                  : "border-border focus:border-primary"
              )}
            />

            {errors.name && (
              <p className="mt-1 text-xs text-red-500">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Email Address
            </label>

            <input
              {...register("email")}
              type="email"
              placeholder="you@example.com"
              className={cn(
                "w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none transition",
                "placeholder:text-muted-foreground",
                errors.email
                  ? "border-red-500 focus:border-red-500"
                  : "border-border focus:border-primary"
              )}
            />

            {errors.email && (
              <p className="mt-1 text-xs text-red-500">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Password
            </label>

            <input
              {...register("password")}
              type="password"
              placeholder="Create a secure password"
              className={cn(
                "w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none transition",
                "placeholder:text-muted-foreground",
                errors.password
                  ? "border-red-500 focus:border-red-500"
                  : "border-border focus:border-primary"
              )}
            />

            {errors.password && (
              <p className="mt-1 text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground transition-colors",
              isSubmitting
                ? "cursor-not-allowed opacity-70"
                : "hover:opacity-90"
            )}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
import { Form, useNavigation } from "react-router";
import type { ProblemDetails } from "@media-tracker/shared";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { fieldErrors } from "~/lib/api";

interface AuthFormProps {
  title: string;
  description: React.ReactNode;
  fields: { name: string; label: string; type: string; autoComplete: string }[];
  submitLabel: string;
  problem: ProblemDetails | undefined;
}

/** The sign-in and registration forms. */
export function AuthForm({ title, description, fields, submitLabel, problem }: AuthFormProps) {
  const navigation = useNavigation();
  const errors = fieldErrors(problem);
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {problem && !problem.errors && (
          <Alert variant="destructive">
            <AlertTitle>
              {problem.status} {problem.title}
            </AlertTitle>
            <AlertDescription>{problem.detail}</AlertDescription>
          </Alert>
        )}
        <Form method="post">
          <FieldGroup>
            {fields.map(({ name, label, type, autoComplete }) => (
              <Field key={name} data-invalid={!!errors[name] || undefined}>
                <FieldLabel htmlFor={name}>{label}</FieldLabel>
                <Input id={name} name={name} type={type} autoComplete={autoComplete} aria-invalid={!!errors[name] || undefined} />
                <FieldError>{errors[name]}</FieldError>
              </Field>
            ))}
            <Field orientation="horizontal">
              <Button type="submit" className="w-full" disabled={navigation.state === "submitting"}>
                {navigation.state === "submitting" && <Spinner data-icon="inline-start" />}
                {submitLabel}
              </Button>
            </Field>
          </FieldGroup>
        </Form>
      </CardContent>
    </Card>
  );
}

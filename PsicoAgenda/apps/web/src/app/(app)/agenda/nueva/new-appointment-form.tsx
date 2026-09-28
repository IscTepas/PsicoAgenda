"use client"

import { useRouter } from "next/navigation"
import {
  AppointmentModality,
  createAppointmentSchema,
  MAX_APPOINTMENT_DURATION,
  MIN_APPOINTMENT_DURATION,
} from "@psicoagenda/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "../../components/page-header"
import { MOCK_PATIENTS } from "@/lib/mock-data"

export function NewAppointmentForm() {
  const router = useRouter()
  const form = useForm({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      psychologistId: "",
      patientId: "",
      startTime: new Date(),
      durationMinutes: 50,
      modality: AppointmentModality.IN_PERSON,
      reason: "",
    },
  })

  function onSubmit() {
    // TODO: crear cita llamando a la API
    router.push("/agenda")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva cita"
        description="Programa una nueva sesión con un paciente"
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de la cita</CardTitle>
          <CardDescription>
            Completa la información para agendar la sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paciente</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un paciente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MOCK_PATIENTS.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha y hora</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={
                            field.value instanceof Date
                              ? new Date(
                                  field.value.getTime() -
                                    field.value.getTimezoneOffset() * 60000
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={MIN_APPOINTMENT_DURATION}
                          max={MAX_APPOINTMENT_DURATION}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="modality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalidad</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona modalidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={AppointmentModality.IN_PERSON}>
                          Presencial
                        </SelectItem>
                        <SelectItem value={AppointmentModality.VIRTUAL}>
                          Virtual
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Motivo de la consulta"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-2">
                <Button type="submit">Guardar cita</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/agenda")}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

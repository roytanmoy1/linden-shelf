import { Button, Field, Input, MessageBar, MessageBarBody, Textarea } from '@fluentui/react-components';
import { ENQUIRY_BOUNDS, enquirySchema, type Product } from '@linden-shelf/contracts';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, type ApiClient } from '../api/client.js';

const validationMessages = {
  name: `Enter a valid name (1-${ENQUIRY_BOUNDS.name} characters).`,
  email: 'Enter a valid email address.',
  message: `Keep your message within ${ENQUIRY_BOUNDS.message} characters.`,
};
type ContactField = keyof typeof validationMessages;

export function Enquiry({ product, client }: { product: Product; client: ApiClient }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [failure, setFailure] = useState<ApiError | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open && !sent) formRef.current?.querySelector<HTMLElement>('[name="name"]')?.focus();
    if (sent) confirmationRef.current?.focus();
  }, [open, sent]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (!pending && first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [errors, pending]);

  function showFieldErrors(fields: string[]) {
    const knownFields = fields.filter((field): field is ContactField => Object.hasOwn(validationMessages, field));
    setErrors(Object.fromEntries(knownFields.map((field) => [field, validationMessages[field]])));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeRequest.current) return;
    const values = new FormData(event.currentTarget);
    const enquiry = enquirySchema.safeParse({
      productId: product.id, name: values.get('name'), email: values.get('email'), message: values.get('message'),
    });
    setFailure(null);
    if (!enquiry.success) {
      showFieldErrors(enquiry.error.issues.map((issue) => String(issue.path[0])));
      return;
    }
    setErrors({});
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    try {
      await client.sendEnquiry(enquiry.data, controller.signal);
      if (!controller.signal.aborted) setSent(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      const failure = error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR');
      setFailure(failure);
      showFieldErrors(failure.fields);
    } finally {
      activeRequest.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  if (sent) return <section className="enquiry-confirmation" aria-labelledby="enquiry-confirmation">
    <h2 id="enquiry-confirmation" tabIndex={-1} ref={confirmationRef}>Thank you</h2>
    <MessageBar intent="success" role="status" icon={<CheckCircle2 size={20} aria-hidden="true" />}>
      <MessageBarBody>Your enquiry has been sent to our sales team.</MessageBarBody>
    </MessageBar>
  </section>;

  const retryMinutes = failure?.retryAfterSeconds ? Math.ceil(failure.retryAfterSeconds / 60) : null;
  return <div className="enquiry-section">
    <div className="detail-actions" ref={actionsRef}>
      <Button appearance="primary" size="large" icon={<Mail size={18} aria-hidden="true" />}
        aria-expanded={open} aria-controls={open ? 'enquiry-form' : undefined} onClick={() => setOpen(true)}>Enquire</Button>
    </div>
    {open && <form id="enquiry-form" ref={formRef} className="enquiry-form" aria-labelledby="enquiry-heading"
      noValidate aria-busy={pending} onSubmit={(event) => void submit(event)}>
      <h2 id="enquiry-heading">Contact sales</h2>
      {failure && <MessageBar intent="error" role="alert"><MessageBarBody>
        {failure.message}{failure.code === 'RATE_LIMITED' && retryMinutes !== null
          ? ` Try again in about ${retryMinutes} ${retryMinutes === 1 ? 'minute' : 'minutes'}.` : ''}
      </MessageBarBody></MessageBar>}
      <div className="contact-fields">
        <Field label="Name" required validationState={errors.name ? 'error' : 'none'} validationMessage={errors.name ?? null}>
          <Input name="name" autoComplete="name" required maxLength={ENQUIRY_BOUNDS.name} disabled={pending} />
        </Field>
        <Field label="Email" required validationState={errors.email ? 'error' : 'none'} validationMessage={errors.email ?? null}>
          <Input name="email" type="email" autoComplete="email" required maxLength={ENQUIRY_BOUNDS.email} disabled={pending} />
        </Field>
      </div>
      <Field label="Message (optional)" validationState={errors.message ? 'error' : 'none'} validationMessage={errors.message ?? null}>
        <Textarea name="message" rows={4} resize="vertical" maxLength={ENQUIRY_BOUNDS.message} disabled={pending} />
      </Field>
      <div className="action-row">
        <Button type="submit" appearance="primary" icon={<Send size={17} aria-hidden="true" />} disabled={pending}>
          {pending ? 'Sending...' : 'Send enquiry'}</Button>
        <Button type="button" disabled={pending} onClick={() => {
          setOpen(false);
          setErrors({});
          setFailure(null);
          actionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        }}>Cancel</Button>
      </div>
      {pending && <span className="visually-hidden" role="status">Sending enquiry...</span>}
    </form>}
  </div>;
}
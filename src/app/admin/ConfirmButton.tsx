"use client";

export function ConfirmButton({
  action,
  confirm,
  className,
  children,
}: {
  action: () => Promise<void>;
  confirm: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={className}
        onClick={(e) => {
          if (!window.confirm(confirm)) e.preventDefault();
        }}
      >
        {children}
      </button>
    </form>
  );
}

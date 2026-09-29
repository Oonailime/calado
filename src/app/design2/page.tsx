import Experience from "@/features/story/Experience";

// A direct link to the dark (volcanic) mode, without changing the saved choice.
export default function DesignTwoPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute("data-theme","dark")` }} />
      <Experience initialTheme="dark" />
    </>
  );
}

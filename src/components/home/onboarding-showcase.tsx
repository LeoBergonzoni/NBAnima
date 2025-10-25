'use client';

import { motion, type Variants } from 'framer-motion';
import Image from 'next/image';

interface OnboardingCardData {
  title: string;
  description: string;
  image: string;
}

export const OnboardingShowcase = ({ cards }: { cards: OnboardingCardData[] }) => {
  const variants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.12,
        duration: 0.5,
        ease: 'easeOut',
      },
    }),
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-8 pr-2 [scrollbar-color:rgba(212,175,55,0.6)_transparent]">
      {cards.map((card, index) => (
        <motion.article
          key={`${card.title}-${index}`}
          className="group relative min-w-[260px] max-w-sm flex-1 overflow-hidden rounded-[1.75rem] border border-accent-gold/40 bg-gradient-to-br from-navy-900/80 via-navy-800/70 to-navy-900/80 p-6 shadow-card backdrop-blur transition-transform duration-300 hover:scale-[1.02]"
          variants={variants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          custom={index}
        >
          <div className="absolute inset-0 opacity-0 transition group-hover:opacity-20">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-gold/20 via-transparent to-accent-coral/20" />
          </div>
          <div className="relative flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {card.title}
              </h3>
              <Image
                src={card.image}
                alt={card.title}
                width={84}
                height={84}
                className="h-32 w-32 rounded-xl border border-white/10 bg-navy-950 object-contain p-2"
              />
            </div>
            <p className="text-sm text-slate-200">{card.description}</p>
          </div>
        </motion.article>
      ))}
    </div>
  );
};
